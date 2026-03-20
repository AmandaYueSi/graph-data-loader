package com.graphdataloader.roleminingbackend;

import com.graphdataloader.roleminingbackend.config.AppProperties;
import io.github.cdimascio.dotenv.Dotenv;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(AppProperties.class)
public class RoleMiningBackendApplication {

    public static void main(String[] args) {
        Dotenv dotenv = Dotenv.configure()
            .directory("../") // Look in the parent directory where .env is located
            .ignoreIfMissing()
            .load();
        
        dotenv.entries().forEach(entry -> {
            if (System.getProperty(entry.getKey()) == null && System.getenv(entry.getKey()) == null) {
                System.setProperty(entry.getKey(), entry.getValue());
            }
        });

        System.out.println("DEBUG: NEO4J_URI = " + System.getProperty("NEO4J_URI"));
        System.out.println("DEBUG: NEO4J_USERNAME = " + System.getProperty("NEO4J_USERNAME"));

        SpringApplication.run(RoleMiningBackendApplication.class, args);
    }
}
