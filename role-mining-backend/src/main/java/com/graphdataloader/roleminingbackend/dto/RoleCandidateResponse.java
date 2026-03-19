package com.graphdataloader.roleminingbackend.dto;

import com.graphdataloader.roleminingbackend.model.ReviewMetadata;
import com.graphdataloader.roleminingbackend.model.ReviewStatus;
import java.util.List;

public record RoleCandidateResponse(
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
}
