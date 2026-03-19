package com.graphdataloader.roleminingbackend.controller;

import com.graphdataloader.roleminingbackend.dto.EntitlementResponse;
import com.graphdataloader.roleminingbackend.service.CurrentUserProvider;
import com.graphdataloader.roleminingbackend.service.EntitlementService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/entitlements")
public class EntitlementController {

    private final CurrentUserProvider currentUserProvider;
    private final EntitlementService entitlementService;

    public EntitlementController(CurrentUserProvider currentUserProvider, EntitlementService entitlementService) {
        this.currentUserProvider = currentUserProvider;
        this.entitlementService = entitlementService;
    }

    @GetMapping
    public List<EntitlementResponse> getEntitlements(
        HttpServletRequest request,
        @RequestParam(required = false) String application,
        @RequestParam(required = false) String riskLevel,
        @RequestParam(required = false) String keyword
    ) {
        return entitlementService.findEntitlements(
            currentUserProvider.resolveUserId(request),
            application,
            riskLevel,
            keyword
        );
    }
}
