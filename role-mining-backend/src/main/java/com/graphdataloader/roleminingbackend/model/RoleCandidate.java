package com.graphdataloader.roleminingbackend.model;

import java.util.List;

public record RoleCandidate(
    String roleCandidateId,
    String roleName,
    List<String> entitlementSet,
    double supportScore,
    int userCount,
    String cohortScope,
    String candidateType,
    String dominantDepartment,
    String dominantJobTitle,
    String dominantLocation,
    double ruleConfidence,
    double ruleLift,
    ReviewStatus status,
    ReviewMetadata reviewMetadata
) {
    public RoleCandidate withReview(ReviewStatus nextStatus, ReviewMetadata metadata) {
        return new RoleCandidate(
            roleCandidateId,
            roleName,
            entitlementSet,
            supportScore,
            userCount,
            cohortScope,
            candidateType,
            dominantDepartment,
            dominantJobTitle,
            dominantLocation,
            ruleConfidence,
            ruleLift,
            nextStatus,
            metadata
        );
    }
}
