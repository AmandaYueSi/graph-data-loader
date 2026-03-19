package com.graphdataloader.roleminingbackend;

import com.graphdataloader.roleminingbackend.config.AppProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(AppProperties.class)
public class RoleMiningBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(RoleMiningBackendApplication.class, args);
    }
}
