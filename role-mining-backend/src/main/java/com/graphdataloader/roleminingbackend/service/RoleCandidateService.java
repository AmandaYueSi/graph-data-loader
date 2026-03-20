package com.graphdataloader.roleminingbackend.service;

import com.graphdataloader.roleminingbackend.dto.ApproveRoleCandidateRequest;
import com.graphdataloader.roleminingbackend.dto.PagedResponse;
import com.graphdataloader.roleminingbackend.dto.RejectRoleCandidateRequest;
import com.graphdataloader.roleminingbackend.dto.RoleCandidateResponse;
import com.graphdataloader.roleminingbackend.model.ReviewMetadata;
import com.graphdataloader.roleminingbackend.model.ReviewOverlay;
import com.graphdataloader.roleminingbackend.model.ReviewStatus;
import com.graphdataloader.roleminingbackend.model.RoleCandidate;
import com.graphdataloader.roleminingbackend.repository.RoleCandidateRepository;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class RoleCandidateService {

    private final RoleCandidateRepository roleCandidateRepository;

    public RoleCandidateService(RoleCandidateRepository roleCandidateRepository) {
        this.roleCandidateRepository = roleCandidateRepository;
    }

    public PagedResponse<RoleCandidateResponse> findRoleCandidates(
        String status,
        String candidateType,
        String department,
        String location,
        String keyword,
        int page,
        int size
    ) {
        List<RoleCandidateResponse> filtered = roleCandidateRepository.findAll().stream()
            .filter(candidate -> matches(candidate.status().name(), status))
            .filter(candidate -> matches(candidate.candidateType(), candidateType))
            .filter(candidate -> matches(candidate.dominantDepartment(), department))
            .filter(candidate -> matches(candidate.dominantLocation(), location))
            .filter(candidate -> matchesKeyword(candidate, keyword))
            .collect(Collectors.collectingAndThen(Collectors.toList(), this::deduplicateNearEquivalentCandidates))
            .stream()
            .sorted(Comparator.comparingDouble(RoleCandidate::supportScore).reversed())
            .map(this::toResponse)
            .toList();

        int safePage = Math.max(page, 0);
        int safeSize = Math.max(size, 1);
        int fromIndex = Math.min(safePage * safeSize, filtered.size());
        int toIndex = Math.min(fromIndex + safeSize, filtered.size());
        int totalPages = filtered.isEmpty() ? 0 : (int) Math.ceil((double) filtered.size() / safeSize);

        return new PagedResponse<>(
            filtered.subList(fromIndex, toIndex),
            safePage,
            safeSize,
            filtered.size(),
            totalPages
        );
    }

    public RoleCandidateResponse getById(String roleCandidateId) {
        return roleCandidateRepository.findById(roleCandidateId)
            .map(this::toResponse)
            .orElseThrow(() -> new IllegalArgumentException("Role candidate not found: " + roleCandidateId));
    }

    public RoleCandidateResponse approve(String roleCandidateId, ApproveRoleCandidateRequest request) {
        ReviewOverlay overlay = new ReviewOverlay(
            roleCandidateId,
            ReviewStatus.APPROVED,
            new ReviewMetadata(request.reviewer(), request.comment(), null, Instant.now())
        );
        return toResponse(roleCandidateRepository.saveReview(overlay));
    }

    public RoleCandidateResponse reject(String roleCandidateId, RejectRoleCandidateRequest request) {
        ReviewOverlay overlay = new ReviewOverlay(
            roleCandidateId,
            ReviewStatus.REJECTED,
            new ReviewMetadata(request.reviewer(), null, request.reason(), Instant.now())
        );
        return toResponse(roleCandidateRepository.saveReview(overlay));
    }

    private boolean matches(String actual, String filter) {
        return filter == null || filter.isBlank() || actual.equalsIgnoreCase(filter);
    }

    private boolean matchesKeyword(RoleCandidate candidate, String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return true;
        }
        String normalized = keyword.toLowerCase();
        return candidate.roleCandidateId().toLowerCase().contains(normalized)
            || candidate.roleName().toLowerCase().contains(normalized)
            || candidate.entitlementSet().stream().anyMatch(item -> item.toLowerCase().contains(normalized));
    }

    private List<RoleCandidate> deduplicateNearEquivalentCandidates(List<RoleCandidate> candidates) {
        Map<DeduplicationKey, RoleCandidate> deduplicated = candidates.stream()
            .collect(Collectors.toMap(
                this::toDeduplicationKey,
                Function.identity(),
                this::pickPreferredCandidate
            ));
        return deduplicated.values().stream().toList();
    }

    private DeduplicationKey toDeduplicationKey(RoleCandidate candidate) {
        return new DeduplicationKey(
            candidate.userCount(),
            candidate.supportScore(),
            candidate.cohortScope(),
            candidate.candidateType(),
            candidate.dominantDepartment(),
            candidate.dominantJobTitle(),
            candidate.dominantLocation()
        );
    }

    private RoleCandidate pickPreferredCandidate(RoleCandidate left, RoleCandidate right) {
        Comparator<RoleCandidate> comparator = Comparator
            .comparingInt((RoleCandidate candidate) -> candidate.entitlementSet().size()).reversed()
            .thenComparingDouble(RoleCandidate::ruleLift).reversed()
            .thenComparingDouble(RoleCandidate::ruleConfidence).reversed()
            .thenComparing(RoleCandidate::roleCandidateId);

        return comparator.compare(left, right) <= 0 ? left : right;
    }

    private RoleCandidateResponse toResponse(RoleCandidate candidate) {
        return new RoleCandidateResponse(
            candidate.roleCandidateId(),
            candidate.roleName(),
            candidate.entitlementSet(),
            candidate.supportScore(),
            candidate.userCount(),
            candidate.cohortScope(),
            candidate.candidateType(),
            candidate.dominantDepartment(),
            candidate.dominantJobTitle(),
            candidate.dominantLocation(),
            candidate.ruleConfidence(),
            candidate.ruleLift(),
            candidate.status(),
            candidate.reviewMetadata()
        );
    }

    private record DeduplicationKey(
        int userCount,
        double supportScore,
        String cohortScope,
        String candidateType,
        String dominantDepartment,
        String dominantJobTitle,
        String dominantLocation
    ) {
    }
}
