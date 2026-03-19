package com.graphdataloader.roleminingbackend.controller;

import com.graphdataloader.roleminingbackend.dto.BusinessOwnerProfileResponse;
import com.graphdataloader.roleminingbackend.service.BusinessOwnerService;
import com.graphdataloader.roleminingbackend.service.CurrentUserProvider;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class CurrentUserController {

    private final CurrentUserProvider currentUserProvider;
    private final BusinessOwnerService businessOwnerService;

    public CurrentUserController(CurrentUserProvider currentUserProvider, BusinessOwnerService businessOwnerService) {
        this.currentUserProvider = currentUserProvider;
        this.businessOwnerService = businessOwnerService;
    }

    @GetMapping("/me")
    public BusinessOwnerProfileResponse getCurrentUser(HttpServletRequest request) {
        return businessOwnerService.getBusinessOwnerProfile(currentUserProvider.resolveUserId(request));
    }
}
