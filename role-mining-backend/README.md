# Role Mining Backend

Spring Boot backend service for the Role Mining Analyst UI.

## What it exposes

- `GET /api/me`
- `GET /api/role-candidates`
- `GET /api/role-candidates/{id}`
- `POST /api/role-candidates/{id}/approve`
- `POST /api/role-candidates/{id}/reject`
- `GET /api/entitlements`

## Data sources

- Neo4j: business owner profile and entitlement data
- `role_candidates_v1.json`: role candidate source data
- `data/role-candidate-reviews.json`: review action overlay persisted by the API

## Notes

- Current user is resolved from `X-User-Id` header, falling back to the configured default user.
- Role candidate data is intentionally behind a repository interface so the JSON source can be swapped for a database later.
- Review actions do not mutate the source JSON. They are stored in the overlay file and merged at read time.

## Run

Requires Java 17+ and Maven.

```bash
cd role-mining-backend
mvn spring-boot:run
```

If your role candidate file lives elsewhere, override:

```bash
export ROLE_CANDIDATES_PATH=/absolute/path/to/role_candidates_v1.json
```
