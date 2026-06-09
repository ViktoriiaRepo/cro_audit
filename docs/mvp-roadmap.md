# MVP Development Roadmap

## Phase 1: Project Setup

- Scaffold Vite React app with TypeScript
- Set up Tailwind CSS
- Set up Express backend with TypeScript
- Create shared types package or shared folder
- Configure Supabase connection

## Phase 2: Audit Core

- Create audit records
- Store shop and audit metadata
- Build initial checklist model
- Render editable checklist table
- Implement scoring service

## Phase 3: Scanner

- Add Playwright scanning pipeline
- Detect Shopify
- Discover pages
- Run checklist checks
- Persist scan findings

## Phase 4: Persistence and Editing

- Save audit items to Supabase
- Allow inline edits
- Recalculate scores after changes
- Track manual overrides

## Phase 5: Export

- Export CSV
- Export XLSX
- Export PDF

## Phase 6: Hardening

- Add validation
- Add logging
- Add error handling
- Add basic auth if needed
- Add rate limiting

## Phase 7: Later Enhancements

- AI recommendations
- screenshot capture
- historical audits
- re-scan comparisons
