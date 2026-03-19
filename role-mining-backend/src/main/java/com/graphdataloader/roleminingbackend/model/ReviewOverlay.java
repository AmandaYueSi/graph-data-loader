package com.graphdataloader.roleminingbackend.model;

public record ReviewOverlay(
    String roleCandidateId,
    ReviewStatus status,
    ReviewMetadata reviewMetadata
) {
}
