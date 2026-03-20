package com.graphdataloader.roleminingbackend.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private final Security security = new Security();
    private final Data data = new Data();
    private final Neo4j neo4j = new Neo4j();
    private final Ai ai = new Ai();

    @Getter
    @Setter
    public static class Security {
        private String defaultUserId;
    }

    @Getter
    @Setter
    public static class Data {
        private String roleCandidatesPath;
        private String reviewOverlaysPath;
        private boolean ownershipScopingEnabled;
    }

    @Getter
    @Setter
    public static class Neo4j {
        private String uri;
        private String username;
        private String password;
    }

    @Getter
    @Setter
    public static class Ai {
        private String openAiApiKey;
        private String awsRegion;
        private String awsAccessKeyId;
        private String awsSecretAccessKey;
        private String awsSessionToken;
        private String bedrockModelId;
    }
}
