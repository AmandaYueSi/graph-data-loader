package com.graphdataloader.roleminingbackend.service;

import com.graphdataloader.roleminingbackend.dto.ApplicationSummaryResponse;
import com.graphdataloader.roleminingbackend.dto.BusinessOwnerProfileResponse;
import com.graphdataloader.roleminingbackend.dto.OwnedEntitlementResponse;
import com.graphdataloader.roleminingbackend.exception.BusinessOwnerNotFoundException;
import com.graphdataloader.roleminingbackend.exception.Neo4jAccessException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.neo4j.driver.Driver;
import org.neo4j.driver.exceptions.Neo4jException;
import org.neo4j.driver.exceptions.NoSuchRecordException;
import org.neo4j.driver.Record;
import org.neo4j.driver.Value;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class BusinessOwnerService {

    private static final Logger logger = LoggerFactory.getLogger(BusinessOwnerService.class);

    private final Driver driver;

    public BusinessOwnerService(Driver driver) {
        this.driver = driver;
    }

    public BusinessOwnerProfileResponse getBusinessOwnerProfile(String userId) {
        String query = """
            MATCH (bo:BusinessOwner {owner_id: $userId})
            OPTIONAL MATCH (a:Application)-[:OWNED_BY]->(bo)
            WITH bo, collect(DISTINCT {
                applicationId: a.app_id,
                applicationName: a.name
            }) AS ownedApplications
            OPTIONAL MATCH (bo)<-[:OWNED_BY]-(app:Application)<-[:PART_OF]-(:Resource)<-[:ON_RESOURCE]-(e:Entitlement)
            WITH bo, ownedApplications, collect(DISTINCT {
                entitlementId: e.entitlement_id,
                entitlementName: e.name,
                applicationId: app.app_id,
                applicationName: app.name
            }) AS ownedEntitlements
            RETURN bo.owner_id AS businessOwnerId,
                   bo.name AS name,
                   coalesce(bo.email, '') AS email,
                   coalesce(bo.department, '') AS department,
                   coalesce(bo.title, '') AS title,
                   coalesce(bo.location, '') AS location,
                   ownedApplications,
                   ownedEntitlements
            """;

        try (var session = driver.session()) {
            Record record = session.run(query, Map.of("userId", userId)).single();
            List<ApplicationSummaryResponse> applications = mapApplications(record.get("ownedApplications").asList(Value::asMap));
            List<OwnedEntitlementResponse> entitlements = mapOwnedEntitlements(record.get("ownedEntitlements").asList(Value::asMap));
            return new BusinessOwnerProfileResponse(
                record.get("businessOwnerId").asString(),
                record.get("name").asString(""),
                record.get("email").asString(""),
                record.get("department").asString(""),
                record.get("title").asString(""),
                record.get("location").asString(""),
                applications,
                entitlements
            );
        } catch (NoSuchRecordException exception) {
            logger.info("Business owner lookup returned no record for userId={}", userId);
            throw new BusinessOwnerNotFoundException(userId);
        } catch (Neo4jException exception) {
            logger.error("Neo4j error while loading business owner profile for userId={}", userId, exception);
            throw new Neo4jAccessException("Failed to access Neo4j while loading business owner profile.", exception);
        } catch (RuntimeException exception) {
            logger.error("Unexpected error while loading business owner profile for userId={}", userId, exception);
            throw exception;
        }
    }

    private List<ApplicationSummaryResponse> mapApplications(List<Map<String, Object>> rows) {
        List<ApplicationSummaryResponse> results = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Object id = row.get("applicationId");
            if (id == null) {
                continue;
            }
            results.add(new ApplicationSummaryResponse(
                String.valueOf(id),
                String.valueOf(row.getOrDefault("applicationName", ""))
            ));
        }
        return results;
    }

    private List<OwnedEntitlementResponse> mapOwnedEntitlements(List<Map<String, Object>> rows) {
        List<OwnedEntitlementResponse> results = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Object id = row.get("entitlementId");
            if (id == null) {
                continue;
            }
            results.add(new OwnedEntitlementResponse(
                String.valueOf(id),
                String.valueOf(row.getOrDefault("entitlementName", "")),
                String.valueOf(row.getOrDefault("applicationId", "")),
                String.valueOf(row.getOrDefault("applicationName", ""))
            ));
        }
        return results;
    }
}
