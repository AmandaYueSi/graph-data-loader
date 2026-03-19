package com.graphdataloader.roleminingbackend.dto;

import java.util.List;

public record BusinessOwnerProfileResponse(
    String businessOwnerId,
    String name,
    String email,
    String department,
    String title,
    String location,
    List<ApplicationSummaryResponse> ownedApplications,
    List<OwnedEntitlementResponse> ownedEntitlements
) {
}
