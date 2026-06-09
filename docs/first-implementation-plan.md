# First Implementation Plan

## Build Order

1. Define shared TypeScript types for audit items, pages, scores, and scan findings.
2. Set up Supabase schema and insert the first audit record flow.
3. Build backend audit creation and retrieval endpoints.
4. Add the initial checklist seed data.
5. Implement scoring as a pure utility module.
6. Build the audit table UI with inline editing.
7. Add Playwright scanning for Shopify detection and page discovery.
8. Map scanner findings into checklist item updates.
9. Add export generation.
10. Add polish, validation, and error handling.

## First Coding Slice

The first working slice should be:

- create an audit from a URL
- detect Shopify
- generate a checklist with default assessments
- persist the audit to Supabase
- show the editable table in the UI
- recalculate scores on edit

## Immediate Deliverables

- working project scaffold
- shared types module
- Supabase migration files
- basic Express API
- basic React audit page
- scoring utility tests
