# Backend API Structure

Use Node.js + Express with TypeScript. The backend should own URL validation, scanning orchestration, audit persistence, scoring recalculation, and exports.

## Module Boundaries

- `routes`: request routing and validation
- `controllers`: request/response handling
- `services`: business logic
- `scanner`: Playwright-based storefront scanning
- `scoring`: audit score calculation
- `exports`: CSV, XLSX, PDF generation
- `db`: Supabase access layer

## Core Endpoints

### `POST /api/audits`

Create a new audit draft.

Request:

- `url`
- `name` optional

Response:

- audit record

### `POST /api/audits/:id/scan`

Start or rerun the store scan.

Response:

- scan status
- discovered pages
- partial findings

### `GET /api/audits/:id`

Fetch one audit with pages, checklist items, and scores.

### `PATCH /api/audits/:id/items/:itemId`

Update an editable checklist row.

Supports updates to:

- assessment
- notes
- findings
- page_url
- impact

### `POST /api/audits/:id/recalculate`

Recompute all scores after manual edits.

### `GET /api/audits/:id/export?format=csv|xlsx|pdf`

Export the audit in the requested format.

### `GET /api/health`

Basic service health check.

## Service Flow

1. Controller validates input.
2. Service creates or loads the audit.
3. Scanner runs page discovery and detection.
4. Findings are mapped to checklist items.
5. Scoring service calculates priority and performance metrics.
6. Database layer persists the result.
7. Export service renders the requested format.

## Validation Rules

- Reject invalid URLs early.
- Normalize URL to a canonical domain before scan.
- Prevent scanning the same audit concurrently.
- Never overwrite manual edits without explicit user action.
