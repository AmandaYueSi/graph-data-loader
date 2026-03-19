package com.graphdataloader.roleminingbackend.service;

import com.graphdataloader.roleminingbackend.config.AppProperties;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

@Component
public class CurrentUserProvider {

    private final AppProperties properties;

    public CurrentUserProvider(AppProperties properties) {
        this.properties = properties;
    }

    public String resolveUserId(HttpServletRequest request) {
        String headerValue = request.getHeader("X-User-Id");
        if (headerValue != null && !headerValue.isBlank()) {
            return headerValue;
        }
        return properties.getSecurity().getDefaultUserId();
    }
}
