package com.graphdataloader.roleminingbackend.dto;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Builder
public class ImpactDimension {
    private String department;
    private long count;
}
