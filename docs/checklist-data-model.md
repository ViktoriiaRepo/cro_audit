# Checklist Data Model

The checklist should be represented as a reusable typed model that drives both the scanner mapping and the editable UI table.

## Item Shape

Each checklist item should include:

- `id`
- `itemNumber`
- `itemKey`
- `itemLabel`
- `assessment`
- `impact`
- `example`
- `notes`
- `findingsAndRecommendations`
- `pageUrl`
- `priority`
- `impactScore`
- `fullImpactScore`
- `priorityScore`
- `priorityLabel`
- `performanceScore`
- `autoFilled`
- `source`

## Assessment Values

- `good`
- `can_be_improved`
- `bad`
- `irrelevant`

## Impact Values

- `high`
- `medium`
- `low`

## Data Ownership

- Scanner sets default or suggested values.
- User edits override scanner values.
- The UI stores the editable table state.
- The backend persists the final audit snapshot.

## Suggested TypeScript Types

```ts
export type Assessment = 'good' | 'can_be_improved' | 'bad' | 'irrelevant';
export type Impact = 'high' | 'medium' | 'low';

export interface AuditItem {
  id: string;
  itemNumber: number;
  itemKey: string;
  itemLabel: string;
  assessment: Assessment;
  impact: Impact;
  example?: string;
  notes?: string;
  findingsAndRecommendations?: string;
  pageUrl?: string;
  priority?: string;
  impactScore?: number;
  fullImpactScore?: number;
  priorityScore?: number;
  priorityLabel?: 'Low' | 'Medium' | 'High';
  performanceScore?: number;
  autoFilled: boolean;
  source?: 'scan' | 'manual' | 'default';
}
```
