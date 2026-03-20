package com.graphdataloader.roleminingbackend.controller;

import com.graphdataloader.roleminingbackend.dto.ImpactResult;
import com.graphdataloader.roleminingbackend.service.DynamicImpactService;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/impact")
public class DynamicImpactController {
    private static final Logger log = LoggerFactory.getLogger(DynamicImpactController.class);

    private final DynamicImpactService dynamicImpactService;

    public DynamicImpactController(DynamicImpactService dynamicImpactService) {
        this.dynamicImpactService = dynamicImpactService;
    }

    @GetMapping("/analyze")
    public List<ImpactResult> analyzeImpact(
        @RequestParam String term,
        @RequestParam(defaultValue = "app") String type
    ) {
        log.info("Received impact analysis request: term='{}', type='{}'", term, type);
        List<ImpactResult> results = dynamicImpactService.analyzeImpact(term, type);
        log.info(
            "Completed impact analysis request: term='{}', type='{}', results={}",
            term,
            type,
            results.size()
        );
        return results;
    }
}
