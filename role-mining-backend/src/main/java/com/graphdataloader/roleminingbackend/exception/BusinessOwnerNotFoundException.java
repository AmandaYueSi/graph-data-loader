package com.graphdataloader.roleminingbackend.exception;

public class BusinessOwnerNotFoundException extends RuntimeException {

    public BusinessOwnerNotFoundException(String userId) {
        super("Business owner not found for user: " + userId);
    }
}
