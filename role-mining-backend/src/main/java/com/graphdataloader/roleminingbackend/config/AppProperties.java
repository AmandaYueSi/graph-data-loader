package com.graphdataloader.roleminingbackend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private final Security security = new Security();
    private final Data data = new Data();
    private final Neo4j neo4j = new Neo4j();

    public Security getSecurity() {
        return security;
    }

    public Data getData() {
        return data;
    }

    public Neo4j getNeo4j() {
        return neo4j;
    }

    public static class Security {
        private String defaultUserId;

        public String getDefaultUserId() {
            return defaultUserId;
        }

        public void setDefaultUserId(String defaultUserId) {
            this.defaultUserId = defaultUserId;
        }
    }

    public static class Data {
        private String roleCandidatesPath;
        private String reviewOverlaysPath;
        private boolean ownershipScopingEnabled;

        public String getRoleCandidatesPath() {
            return roleCandidatesPath;
        }

        public void setRoleCandidatesPath(String roleCandidatesPath) {
            this.roleCandidatesPath = roleCandidatesPath;
        }

        public String getReviewOverlaysPath() {
            return reviewOverlaysPath;
        }

        public void setReviewOverlaysPath(String reviewOverlaysPath) {
            this.reviewOverlaysPath = reviewOverlaysPath;
        }

        public boolean isOwnershipScopingEnabled() {
            return ownershipScopingEnabled;
        }

        public void setOwnershipScopingEnabled(boolean ownershipScopingEnabled) {
            this.ownershipScopingEnabled = ownershipScopingEnabled;
        }
    }

    public static class Neo4j {
        private String uri;
        private String username;
        private String password;

        public String getUri() {
            return uri;
        }

        public void setUri(String uri) {
            this.uri = uri;
        }

        public String getUsername() {
            return username;
        }

        public void setUsername(String username) {
            this.username = username;
        }

        public String getPassword() {
            return password;
        }

        public void setPassword(String password) {
            this.password = password;
        }
    }
}
