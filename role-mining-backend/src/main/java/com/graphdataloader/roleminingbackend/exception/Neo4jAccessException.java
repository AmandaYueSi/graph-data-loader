package com.graphdataloader.roleminingbackend.exception;

public class Neo4jAccessException extends RuntimeException {

    public Neo4jAccessException(String message, Throwable cause) {
        super(message, cause);
    }
}
