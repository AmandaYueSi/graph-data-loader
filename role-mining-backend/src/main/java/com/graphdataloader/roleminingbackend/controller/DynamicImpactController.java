package com.graphdataloader.roleminingbackend.controller;

import com.graphdataloader.roleminingbackend.dto.ImpactResult;
import com.graphdataloader.roleminingbackend.service.DynamicImpactService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/impact")
public class DynamicImpactController {

    private final DynamicImpactService dynamicImpactService;

    public DynamicImpactController(DynamicImpactService dynamicImpactService) {
        this.dynamicImpactService = dynamicImpactService;
    }

    @GetMapping("/analyze")
    public List<ImpactResult> analyzeImpact(
        @RequestParam String term,
        @RequestParam(defaultValue = "app") String type
    ) {
        return dynamicImpactService.analyzeImpact(term, type);
    }
}
