package com.graphdataloader.roleminingbackend.repository;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.graphdataloader.roleminingbackend.config.AppProperties;
import com.graphdataloader.roleminingbackend.model.ReviewMetadata;
import com.graphdataloader.roleminingbackend.model.ReviewOverlay;
import com.graphdataloader.roleminingbackend.model.ReviewStatus;
import com.graphdataloader.roleminingbackend.model.RoleCandidate;
import com.graphdataloader.roleminingbackend.model.RoleCandidateSourceDocument;
import java.io.IOException;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.stereotype.Repository;

@Repository
public class JsonRoleCandidateRepository implements RoleCandidateRepository {

    private final ObjectMapper objectMapper;
    private final ReviewOverlayRepository reviewOverlayRepository;
    private final Path sourcePath;

    public JsonRoleCandidateRepository(
        ObjectMapper objectMapper,
        ReviewOverlayRepository reviewOverlayRepository,
        AppProperties properties
    ) {
        this.objectMapper = objectMapper;
        this.reviewOverlayRepository = reviewOverlayRepository;
        this.sourcePath = Path.of(properties.getData().getRoleCandidatesPath()).toAbsolutePath();
    }

    @Override
    public List<RoleCandidate> findAll() {
        Map<String, ReviewOverlay> overlays = reviewOverlayRepository.loadAll();
        return loadSourceDocument().roleCandidates().stream()
            .map(item -> toRoleCandidate(item, overlays.get(item.roleCandidateId())))
            .collect(Collectors.toList());
    }

    @Override
    public Optional<RoleCandidate> findById(String roleCandidateId) {
        return findAll().stream()
            .filter(candidate -> candidate.roleCandidateId().equals(roleCandidateId))
            .findFirst();
    }

    @Override
    public RoleCandidate saveReview(ReviewOverlay overlay) {
        reviewOverlayRepository.save(overlay);
        return findById(overlay.roleCandidateId())
            .orElseThrow(() -> new IllegalArgumentException("Role candidate not found: " + overlay.roleCandidateId()));
    }

    private RoleCandidateSourceDocument loadSourceDocument() {
        try {
            return objectMapper.readValue(sourcePath.toFile(), RoleCandidateSourceDocument.class);
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to read role candidate source file: " + sourcePath, exception);
        }
    }

    private RoleCandidate toRoleCandidate(RoleCandidateSourceDocument.RoleCandidateItem item, ReviewOverlay overlay) {
        ReviewStatus status = overlay != null ? overlay.status() : ReviewStatus.PENDING;
        ReviewMetadata metadata = overlay != null ? overlay.reviewMetadata() : null;
        return new RoleCandidate(
            item.roleCandidateId(),
            item.roleName(),
            item.entitlementSet(),
            item.supportScore(),
            item.userCount(),
            item.cohortScope(),
            item.candidateType(),
            item.dominantDepartment(),
            item.dominantJobTitle(),
            item.dominantLocation(),
            item.ruleConfidence(),
            item.ruleLift(),
            status,
            metadata
        );
    }
}
