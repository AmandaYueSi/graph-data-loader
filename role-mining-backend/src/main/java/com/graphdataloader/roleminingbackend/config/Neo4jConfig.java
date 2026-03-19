package com.graphdataloader.roleminingbackend.config;

import org.neo4j.driver.AuthTokens;
import org.neo4j.driver.Driver;
import org.neo4j.driver.GraphDatabase;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class Neo4jConfig {

    @Bean(destroyMethod = "close")
    public Driver neo4jDriver(AppProperties properties) {
        return GraphDatabase.driver(
            properties.getNeo4j().getUri(),
            AuthTokens.basic(
                properties.getNeo4j().getUsername(),
                properties.getNeo4j().getPassword()
            )
        );
    }
}
