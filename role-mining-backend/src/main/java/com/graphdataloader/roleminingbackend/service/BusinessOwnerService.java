package com.graphdataloader.roleminingbackend.service;

import com.graphdataloader.roleminingbackend.dto.BusinessOwnerProfileResponse;
import com.graphdataloader.roleminingbackend.exception.BusinessOwnerNotFoundException;
import com.graphdataloader.roleminingbackend.exception.Neo4jAccessException;
import java.util.Map;
import org.neo4j.driver.Driver;
import org.neo4j.driver.exceptions.Neo4jException;
import org.neo4j.driver.exceptions.NoSuchRecordException;
import org.neo4j.driver.Record;
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
            RETURN bo.owner_id AS businessOwnerId,
                   bo.name AS name,
                   coalesce(bo.title, '') AS title,
                   coalesce(bo.department, '') AS department,
                   coalesce(bo.domain, '') AS domain,
                   coalesce(bo.business_responsibility, '') AS businessResponsibility
            """;

        try (var session = driver.session()) {
            Record record = session.run(query, Map.of("userId", userId)).single();
            return new BusinessOwnerProfileResponse(
                record.get("businessOwnerId").asString(),
                record.get("name").asString(""),
                record.get("title").asString(""),
                record.get("department").asString(""),
                record.get("domain").asString(""),
                record.get("businessResponsibility").asString("")
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
}
