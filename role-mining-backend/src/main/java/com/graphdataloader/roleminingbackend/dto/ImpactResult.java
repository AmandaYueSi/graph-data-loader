package com.graphdataloader.roleminingbackend.dto;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;
import java.util.List;

@Getter
@Setter
@Builder
public class ImpactResult {
    private String id;
    private String name;
    private String type;
    private long totalUsers;
    private List<ImpactDimension> topDepartments;
    private String aiNarrative;
}
