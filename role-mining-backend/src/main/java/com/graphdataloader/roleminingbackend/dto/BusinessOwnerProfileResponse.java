package com.graphdataloader.roleminingbackend.dto;

public record BusinessOwnerProfileResponse(
    String businessOwnerId,
    String name,
    String title,
    String department,
    String domain,
    String businessResponsibility
) {
}
