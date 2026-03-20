package com.graphdataloader.roleminingbackend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.graphdataloader.roleminingbackend.config.AppProperties;
import com.graphdataloader.roleminingbackend.dto.ImpactDimension;
import com.graphdataloader.roleminingbackend.dto.ImpactResult;
import com.theokanning.openai.completion.chat.ChatCompletionRequest;
import com.theokanning.openai.completion.chat.ChatMessage;
import com.theokanning.openai.service.OpenAiService;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.neo4j.driver.Driver;
import org.neo4j.driver.Result;
import org.neo4j.driver.Session;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelRequest;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelResponse;

@Slf4j
@Service
public class DynamicImpactService {

    private final Driver driver;
    private final AppProperties properties;
    private final ObjectMapper objectMapper;

    public DynamicImpactService(Driver driver, AppProperties properties, ObjectMapper objectMapper) {
        this.driver = driver;
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    public List<ImpactResult> analyzeImpact(String term, String type) {
        String query = type.equalsIgnoreCase("app") ? getAppImpactQuery() : getEntitlementImpactQuery();
        
        try (Session session = driver.session()) {
            return session.executeRead(tx -> {
                Result result = tx.run(query, Map.of("term", term));
                return result.list(record -> {
                    String id = record.get(0).asString();
                    String name = record.get(1).asString();
                    long totalUsers = record.get(2).asLong();
                    List<Map<String, Object>> topDeptsRaw = record.get(3).asList(v -> v.asMap());
                    
                    List<ImpactDimension> topDepartments = topDeptsRaw.stream()
                        .map(m -> ImpactDimension.builder()
                            .department((String) m.get("department"))
                            .count((Long) m.get("count"))
                            .build())
                        .toList();

                    ImpactResult impactResult = ImpactResult.builder()
                        .id(id)
                        .name(name)
                        .type(type)
                        .totalUsers(totalUsers)
                        .topDepartments(topDepartments)
                        .build();

                    impactResult.setAiNarrative(generateAiNarrative(impactResult));
                    return impactResult;
                });
            });
        } catch (Exception e) {
            log.error("Error analyzing impact for term: {}", term, e);
            return Collections.emptyList();
        }
    }

    private String generateAiNarrative(ImpactResult result) {
        String prompt = String.format(
            "You are an IAM Security Architect. Analyze the following impact data for removing an %s.\n\nData: %s\n\nProvide a 2-3 sentence 'Plain English' explanation of the business impact. Focus on which departments are most affected and the potential 'blast radius' if this was an accidental deletion.",
            result.getType(),
            serializeResult(result)
        );

        // Try Bedrock first
        if (properties.getAi().getAwsRegion() != null && !properties.getAi().getAwsRegion().isBlank()) {
            String narrative = generateBedrockNarrative(prompt);
            if (narrative != null) return narrative;
        }

        // Try OpenAI second
        if (properties.getAi().getOpenAiApiKey() != null && !properties.getAi().getOpenAiApiKey().isBlank() && !properties.getAi().getOpenAiApiKey().equals("your_api_key_here")) {
            String narrative = generateOpenAiNarrative(prompt);
            if (narrative != null) return narrative;
        }

        // Fallback
        if (result.getTotalUsers() > 500) {
            return String.format("CRITICAL: Removal of this %s will cause widespread disruption in %s. Suggest gradual roll-off.", 
                result.getType(), result.getTopDepartments().get(0).getDepartment());
        } else {
            return String.format("MODERATE: Limited impact focused on %s. Risk is localized.", 
                result.getTopDepartments().get(0).getDepartment());
        }
    }

    private String generateOpenAiNarrative(String prompt) {
        try {
            OpenAiService service = new OpenAiService(properties.getAi().getOpenAiApiKey());
            ChatCompletionRequest request = ChatCompletionRequest.builder()
                .model("gpt-4o")
                .messages(List.of(new ChatMessage("user", prompt)))
                .maxTokens(150)
                .build();
            return service.createChatCompletion(request).getChoices().get(0).getMessage().getContent().trim();
        } catch (Exception e) {
            log.warn("Failed to generate OpenAI narrative: {}", e.getMessage());
            return null;
        }
    }

    private String generateBedrockNarrative(String prompt) {
        String modelId = properties.getAi().getBedrockModelId() != null ? properties.getAi().getBedrockModelId() : "amazon.titan-text-express-v1";
        try (BedrockRuntimeClient client = BedrockRuntimeClient.builder()
                .region(Region.of(properties.getAi().getAwsRegion()))
                .build()) {
            
            String body;
            if (modelId.contains("amazon")) {
                body = objectMapper.writeValueAsString(Map.of(
                    "inputText", prompt,
                    "textGenerationConfig", Map.of(
                        "maxTokenCount", 1024,
                        "temperature", 0.5,
                        "topP", 0.9
                    )
                ));
            } else if (modelId.contains("anthropic")) {
                body = objectMapper.writeValueAsString(Map.of(
                    "anthropic_version", "bedrock-2023-05-31",
                    "max_tokens", 200,
                    "messages", List.of(Map.of("role", "user", "content", "Human: " + prompt + "\n\nAssistant:"))
                ));
            } else if (modelId.contains("mistral")) {
                body = objectMapper.writeValueAsString(Map.of(
                    "prompt", "<s>[INST] " + prompt + " [/INST]",
                    "max_tokens", 200,
                    "temperature", 0.5
                ));
            } else {
                return null;
            }

            InvokeModelRequest request = InvokeModelRequest.builder()
                .modelId(modelId)
                .body(SdkBytes.fromUtf8String(body))
                .build();

            InvokeModelResponse response = client.invokeModel(request);
            Map<String, Object> responseBody = objectMapper.readValue(response.body().asUtf8String(), Map.class);

            if (modelId.contains("amazon")) {
                List<Map<String, Object>> results = (List<Map<String, Object>>) responseBody.get("results");
                return (String) results.get(0).get("outputText");
            } else if (modelId.contains("anthropic")) {
                List<Map<String, Object>> content = (List<Map<String, Object>>) responseBody.get("content");
                return (String) content.get(0).get("text");
            } else if (modelId.contains("mistral")) {
                List<Map<String, Object>> outputs = (List<Map<String, Object>>) responseBody.get("outputs");
                return (String) outputs.get(0).get("text");
            }
            return null;
        } catch (Exception e) {
            log.warn("Failed to generate Bedrock narrative: {}", e.getMessage());
            return null;
        }
    }

    private String serializeResult(ImpactResult result) {
        try {
            return objectMapper.writeValueAsString(result);
        } catch (Exception e) {
            return "{}";
        }
    }

    private String getAppImpactQuery() {
        return """
        MATCH (app:Application)
        WHERE app.appId CONTAINS $term OR app.name CONTAINS $term
        
        MATCH (app)<-[:PART_OF]-(res:Resource)<-[:ON_RESOURCE]-(acc:Account)-[:BELONGS_TO]->(user:Identity)
        
        WITH app, count(DISTINCT user) AS total_users, collect(DISTINCT user) AS users
        UNWIND users AS u
        WITH app, total_users, u.department AS dept, count(*) AS dept_count
        ORDER BY dept_count DESC
        
        RETURN 
            app.appId AS appId,
            app.name AS appName,
            total_users,
            collect({department: dept, count: dept_count})[0..3] AS top_departments
        """;
    }

    private String getEntitlementImpactQuery() {
        return """
        MATCH (e:Entitlement)
        WHERE e.entitlementId CONTAINS $term OR e.entitlement_name CONTAINS $term
        
        // Path 1: Direct via Account
        OPTIONAL MATCH (e)<-[:HAS_ENTITLEMENT]-(acc:Account)-[:BELONGS_TO]->(u1:Identity)
        
        // Path 2: Indirect via Groups
        OPTIONAL MATCH (e)<-[:GRANTS]-(grp:EntitlementGroup)<-[:PARENT_OF*0..]-(top_grp:EntitlementGroup)<-[:MEMBER_OF]-(u2:Identity)
        
        WITH e, collect(DISTINCT u1) + collect(DISTINCT u2) AS all_users
        UNWIND all_users AS user
        WITH e, user WHERE user IS NOT NULL
        
        WITH e, count(DISTINCT user) AS total_users, collect(DISTINCT user) AS users
        UNWIND users AS u
        WITH e, total_users, u.department AS dept, count(*) AS dept_count
        ORDER BY dept_count DESC
        
        RETURN 
            e.entitlementId AS entitlementId,
            e.entitlement_name AS name,
            total_users,
            collect({department: dept, count: dept_count})[0..3] AS top_departments
        """;
    }
}
