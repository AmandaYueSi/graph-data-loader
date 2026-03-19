package com.graphdataloader.roleminingbackend.model;

import java.time.Instant;

public record ReviewMetadata(
    String reviewer,
    String comment,
    String reason,
    Instant reviewedAt
) {
}
