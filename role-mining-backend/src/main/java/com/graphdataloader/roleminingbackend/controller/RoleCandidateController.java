package com.graphdataloader.roleminingbackend.controller;

import com.graphdataloader.roleminingbackend.dto.ApproveRoleCandidateRequest;
import com.graphdataloader.roleminingbackend.dto.PagedResponse;
import com.graphdataloader.roleminingbackend.dto.RejectRoleCandidateRequest;
import com.graphdataloader.roleminingbackend.dto.RoleCandidateResponse;
import com.graphdataloader.roleminingbackend.service.RoleCandidateService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/role-candidates")
public class RoleCandidateController {

    private final RoleCandidateService roleCandidateService;

    public RoleCandidateController(RoleCandidateService roleCandidateService) {
        this.roleCandidateService = roleCandidateService;
    }

    @GetMapping
    public PagedResponse<RoleCandidateResponse> getRoleCandidates(
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String candidateType,
        @RequestParam(required = false) String department,
        @RequestParam(required = false) String location,
        @RequestParam(required = false) String keyword,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "25") int size
    ) {
        return roleCandidateService.findRoleCandidates(status, candidateType, department, location, keyword, page, size);
    }

    @GetMapping("/{id}")
    public RoleCandidateResponse getRoleCandidate(@PathVariable("id") String id) {
        return roleCandidateService.getById(id);
    }

    @PostMapping("/{id}/approve")
    public RoleCandidateResponse approveRoleCandidate(
        @PathVariable("id") String id,
        @Valid @RequestBody ApproveRoleCandidateRequest request
    ) {
        return roleCandidateService.approve(id, request);
    }

    @PostMapping("/{id}/reject")
    public RoleCandidateResponse rejectRoleCandidate(
        @PathVariable("id") String id,
        @Valid @RequestBody RejectRoleCandidateRequest request
    ) {
        return roleCandidateService.reject(id, request);
    }
}
