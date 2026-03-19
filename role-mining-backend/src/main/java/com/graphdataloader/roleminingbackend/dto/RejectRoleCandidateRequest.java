package com.graphdataloader.roleminingbackend.dto;

import jakarta.validation.constraints.NotBlank;

public record RejectRoleCandidateRequest(
    @NotBlank String reviewer,
    @NotBlank String reason
) {
}
