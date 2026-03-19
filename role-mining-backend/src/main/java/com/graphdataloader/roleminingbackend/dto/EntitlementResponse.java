package com.graphdataloader.roleminingbackend.dto;

public record EntitlementResponse(
    String entitlementId,
    String entitlementName,
    String applicationId,
    String applicationName,
    String businessOwnerId,
    String businessOwnerName,
    String riskLevel,
    boolean sensitive
) {
}
