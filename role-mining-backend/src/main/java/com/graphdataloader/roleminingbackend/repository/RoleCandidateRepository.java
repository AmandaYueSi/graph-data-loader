package com.graphdataloader.roleminingbackend.repository;

import com.graphdataloader.roleminingbackend.model.ReviewOverlay;
import com.graphdataloader.roleminingbackend.model.RoleCandidate;
import java.util.List;
import java.util.Optional;

public interface RoleCandidateRepository {
    List<RoleCandidate> findAll();
    Optional<RoleCandidate> findById(String roleCandidateId);
    RoleCandidate saveReview(ReviewOverlay overlay);
}
