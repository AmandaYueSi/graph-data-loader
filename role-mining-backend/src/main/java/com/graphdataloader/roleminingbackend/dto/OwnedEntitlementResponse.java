package com.graphdataloader.roleminingbackend.dto;

public record OwnedEntitlementResponse(
    String entitlementId,
    String entitlementName,
    String applicationId,
    String applicationName
) {
}
