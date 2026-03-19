package com.graphdataloader.roleminingbackend.service;

import com.graphdataloader.roleminingbackend.config.AppProperties;
import com.graphdataloader.roleminingbackend.dto.EntitlementResponse;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.neo4j.driver.Driver;
import org.springframework.stereotype.Service;

@Service
public class EntitlementService {

    private final Driver driver;
    private final AppProperties properties;

    public EntitlementService(Driver driver, AppProperties properties) {
        this.driver = driver;
        this.properties = properties;
    }

    public List<EntitlementResponse> findEntitlements(
        String currentUserId,
        String application,
        String riskLevel,
        String keyword
    ) {
        String query = """
            MATCH (e:Entitlement)-[:ON_RESOURCE]->(:Resource)-[:PART_OF]->(a:Application)
            OPTIONAL MATCH (a)-[:OWNED_BY]->(bo:BusinessOwner)
            WHERE ($application IS NULL OR toLower(a.name) = toLower($application))
              AND ($riskLevel IS NULL OR toLower(coalesce(e.risk_level, 'MEDIUM')) = toLower($riskLevel))
              AND ($keyword IS NULL OR toLower(coalesce(e.name, e.entitlement_id)) CONTAINS toLower($keyword))
              AND ($ownershipScoped = false OR bo.owner_id = $currentUserId)
            RETURN e.entitlement_id AS entitlementId,
                   coalesce(e.name, e.entitlement_id) AS entitlementName,
                   a.app_id AS applicationId,
                   a.name AS applicationName,
                   bo.owner_id AS businessOwnerId,
                   bo.name AS businessOwnerName,
                   coalesce(e.risk_level, 'MEDIUM') AS riskLevel,
                   coalesce(e.sensitive, false) AS sensitive
            ORDER BY entitlementName
            """;

        try (var session = driver.session()) {
            Map<String, Object> parameters = new HashMap<>();
            parameters.put("application", normalizeBlank(application));
            parameters.put("riskLevel", normalizeBlank(riskLevel));
            parameters.put("keyword", normalizeBlank(keyword));
            parameters.put("ownershipScoped", properties.getData().isOwnershipScopingEnabled());
            parameters.put("currentUserId", currentUserId);
            return session.run(
                    query,
                    parameters
                )
                .list(record -> new EntitlementResponse(
                    record.get("entitlementId").asString(""),
                    record.get("entitlementName").asString(""),
                    record.get("applicationId").asString(""),
                    record.get("applicationName").asString(""),
                    record.get("businessOwnerId").asString(""),
                    record.get("businessOwnerName").asString(""),
                    record.get("riskLevel").asString("MEDIUM"),
                    record.get("sensitive").asBoolean(false)
                ));
        }
    }

    private String normalizeBlank(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
