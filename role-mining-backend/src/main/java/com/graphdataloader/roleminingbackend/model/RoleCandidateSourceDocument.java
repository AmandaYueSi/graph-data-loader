package com.graphdataloader.roleminingbackend.model;

import java.util.List;

public record RoleCandidateSourceDocument(
    Summary summary,
    List<RoleCandidateItem> roleCandidates
) {
    public record Summary(
        int usersAnalyzed,
        List<String> genericEntitlementsFiltered,
        int candidateCount
    ) {
    }

    public record RoleCandidateItem(
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
        double ruleLift
    ) {
    }
}
