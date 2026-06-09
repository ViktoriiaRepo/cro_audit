# Frontend Page Structure

Use React + Vite + TypeScript with Tailwind CSS.

## Routes

### `/`

Landing page with product explanation and audit creation entry point.

### `/audits/new`

Form for store URL input and audit creation.

### `/audits/:id`

Main audit workspace.

This page should include:

- scan status panel
- discovered pages panel
- editable checklist table
- score summary cards
- export actions

### `/audits/:id/settings`

Optional later page for audit metadata and export preferences.

## Main UI Components

- `StoreUrlForm`
- `ScanStatusCard`
- `DetectedPagesList`
- `AuditChecklistTable`
- `AssessmentSelect`
- `ScoreSummary`
- `ExportActions`
- `AuditNotesPanel`

## Interaction Rules

- Checklist rows must be editable inline.
- Assessment changes should update scores immediately.
- Rows should show whether values came from scan or manual override.
- The UI should surface uncertainty, not hide it.

## UX Notes

- Keep the table dense but readable.
- Use a clear visual distinction between scanned, suggested, and manually edited data.
- Make page discovery and scoring transparent to the user.
