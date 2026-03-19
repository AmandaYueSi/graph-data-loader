package com.graphdataloader.roleminingbackend.controller;

import com.graphdataloader.roleminingbackend.exception.BusinessOwnerNotFoundException;
import com.graphdataloader.roleminingbackend.exception.Neo4jAccessException;
import java.time.Instant;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(BusinessOwnerNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleBusinessOwnerNotFound(BusinessOwnerNotFoundException exception) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
            "timestamp", Instant.now().toString(),
            "error", "NOT_FOUND",
            "message", exception.getMessage()
        ));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException exception) {
        return ResponseEntity.badRequest().body(Map.of(
            "timestamp", Instant.now().toString(),
            "error", "VALIDATION_ERROR",
            "message", exception.getBindingResult().getFieldError() != null
                ? exception.getBindingResult().getFieldError().getDefaultMessage()
                : "Validation failed"
        ));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgument(IllegalArgumentException exception) {
        return ResponseEntity.badRequest().body(Map.of(
            "timestamp", Instant.now().toString(),
            "error", "BAD_REQUEST",
            "message", exception.getMessage()
        ));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalState(IllegalStateException exception) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
            "timestamp", Instant.now().toString(),
            "error", "INTERNAL_ERROR",
            "message", exception.getMessage()
        ));
    }

    @ExceptionHandler(Neo4jAccessException.class)
    public ResponseEntity<Map<String, Object>> handleNeo4jAccess(Neo4jAccessException exception) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of(
            "timestamp", Instant.now().toString(),
            "error", "NEO4J_ACCESS_ERROR",
            "message", exception.getMessage()
        ));
    }
}
