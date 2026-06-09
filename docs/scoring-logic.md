# Scoring Logic

Keep scoring deterministic and easy to explain to users.

## Assessment Penalty

- `good` = `0`
- `irrelevant` = `0`
- `can_be_improved` = `2`
- `bad` = `3`

## Impact Score

- `high` = `1`
- `medium` = `0.7`
- `low` = `0.3`

## Priority Score

`Priority Score = Impact Score + Assessment Penalty`

## Priority Label

- if `Priority Score < 1.1` -> `Low`
- if `Priority Score > 1.7` -> `High`
- otherwise -> `Medium`

## Performance Score

Use a normalized penalty-based score so the overall value stays in the 0 to 100 range.

Recommended MVP formula:

`Performance Score = 100 - round((totalPenalty / maxPossiblePenalty) * 100)`

Where:

- `totalPenalty` is the sum of assessment penalties for all relevant checklist items
- `maxPossiblePenalty` is the sum of the worst-case penalty for each relevant checklist item

This keeps the score relative to checklist size and avoids small checklists producing misleading results.

## Implementation Notes

- Recalculate scores after every edit.
- Keep raw penalty and derived scores separate.
- Do not hide excluded rows; show `irrelevant` clearly in the UI.
