package com.graphdataloader.roleminingbackend.dto;

import jakarta.validation.constraints.NotBlank;

public record ApproveRoleCandidateRequest(
    @NotBlank String reviewer,
    String comment
) {
}
