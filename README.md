# Shopify CRO Audit MVP

This repository is the starting point for a Shopify conversion-rate-optimization audit tool.

The app will:

- scan a Shopify storefront
- auto-fill technical and checklist-based audit items
- let a user manually review and edit every assessment
- calculate scores and priorities
- export the final audit to CSV, XLSX, or PDF

The build plan and product decisions live in [docs/product-requirements.md](docs/product-requirements.md).

## Local Setup

This first slice keeps audit data in memory. Supabase is intentionally not connected yet.

### 1. Install dependencies

```powershell
npm install
```

### 2. Create local environment files

```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env
```

`PAGESPEED_API_KEY` is optional, but recommended. Without it, Google PageSpeed Insights uses a shared no-key quota that can be exhausted quickly.

Add it to `apps/api/.env`:

```env
PAGESPEED_API_KEY=your_google_pagespeed_api_key
```

### 3. Run the backend

```powershell
npm run dev:api
```

The API runs on `http://localhost:4000`.

### 4. Run the frontend

Open a second terminal and run:

```powershell
npm run dev:web
```

The app runs on `http://localhost:5173`.

### 5. Optional verification commands

```powershell
npm run typecheck
npm run build
```

## First Local Flow

1. Enter a store URL on the demo page.
2. The frontend calls the local scan endpoint.
3. The backend returns a demo checklist with auto-filled values where possible.
4. Edit any assessment row inline.
5. The backend keeps the current audit in memory and recalculates scores after each edit.

## API Notes

- `GET /api/demo-audit` returns the current in-memory demo audit.
- `POST /api/scan` runs the scan endpoint.
- `PATCH /api/demo-audit/items/:itemKey` updates one checklist row and recalculates scores.

Supabase storage will be added after this local flow is validated.
