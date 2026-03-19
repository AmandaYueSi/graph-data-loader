package com.graphdataloader.roleminingbackend.repository;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.graphdataloader.roleminingbackend.config.AppProperties;
import com.graphdataloader.roleminingbackend.model.ReviewOverlay;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import org.springframework.stereotype.Repository;

@Repository
public class ReviewOverlayRepository {

    private final ObjectMapper objectMapper;
    private final Path overlayPath;

    public ReviewOverlayRepository(ObjectMapper objectMapper, AppProperties properties) {
        this.objectMapper = objectMapper;
        this.overlayPath = Path.of(properties.getData().getReviewOverlaysPath()).toAbsolutePath();
    }

    public synchronized Map<String, ReviewOverlay> loadAll() {
        try {
            if (Files.notExists(overlayPath)) {
                Files.createDirectories(overlayPath.getParent());
                Files.writeString(overlayPath, "{}");
                return new HashMap<>();
            }
            return objectMapper.readValue(overlayPath.toFile(), new TypeReference<>() {});
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to read role candidate review overlay file.", exception);
        }
    }

    public synchronized void save(ReviewOverlay overlay) {
        Map<String, ReviewOverlay> overlays = loadAll();
        overlays.put(overlay.roleCandidateId(), overlay);
        try {
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(overlayPath.toFile(), overlays);
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to write role candidate review overlay file.", exception);
        }
    }
}
