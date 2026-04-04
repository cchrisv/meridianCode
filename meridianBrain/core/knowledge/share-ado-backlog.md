# Share – ADO Backlog

> **Meridian:** Active — Copilot `#file:core/knowledge/share-ado-backlog.md` (backlog utilities).

Backlog management patterns shared across backlog view, reorder, validate, and sequence prompts.
References: `#file:config/platform-ado/share-ado.md` → `#file:config/core/share-core.md`
NEVER references Salesforce.

## Backlog Input Collection

Collect missing inputs using the interactive question tool:

1. **`area_path`** — prefer selectable options from `ado_defaults.area_paths` when present. If no catalog exists, offer common CRM DREAM options and allow freeform entry.
2. **`work_item_type`** — options: `User Story` (default) · `Bug` · `Task` · `All types`. If `All types` → omit `--type` flag.
3. **`top`** — options: `10` · `25` · `50` (default) · `100` · `All`. If `All` → omit `--top` flag.

## Backlog Display Format

Present backlogs as a numbered table with:
| Column | Description |
|--------|-------------|
| Position | Sequential number |
| ID | Work item ID |
| Title | Work item title |
| Type | Work item type |
| State | Current state |
| Board Column | Board column name |
| Assignee | Assigned person |
| Parent | Parent work item ID |
| Rank Value | Raw rank value |

Include the rank field in use (`StackRank` or `BacklogPriority`) in the summary.

## Backlog Constraints

- **Interactive questions required** — use the interactive question tool for all missing inputs and confirmation gates
- **No blind mutations** — show the current backlog before any reorder, explain the positional impact, and require confirmation before any applied change
- **Scope** — operate within one area path at a time

## Impact Summary Format

Before any reorder, present an impact summary:

- Show the target item's **current position → proposed position**
- List items that will **shift down** if the target moves up
- List items that will **shift up** if the target moves down
- Call out when the move is a **no-op** (item already at requested position)

## Reorder Modes

### Single-item move

1. Confirm target work item and requested position
2. Present impact summary
3. Ask: `Apply` · `Revise` · `Cancel`
4. `{{cli.ado_reorder}} {{id}} --position {{n}} --area-path "{{path}}" [--type "{{type}}"] --json`

### Bulk reorder

1. Dry-run first: `{{cli.ado_reorder_bulk}} --ids "{{csv}}" --area-path "{{path}}" [--type "{{type}}"] --dry-run --json`
2. Compare current vs dry-run → present impact summary (items moving up/down with old → new positions)
3. Ask: `Apply` · `Revise` · `Cancel`
4. If approved, run without `--dry-run`

### Full resequence

1. Use current backlog ID order
2. Explain impact: if only rank spacing is rewritten and positions stay the same, say that explicitly
3. Ask: `Apply` · `Cancel`
4. Run bulk reorder with current ordered IDs and default spacing

## Post-Reorder Validation

After any applied change:

1. Show updated backlog: `{{cli.ado_backlog}} --area-path "{{path}}" [--type "{{type}}"] --json`
2. Validate rank health: `{{cli.ado_backlog_validate}} --area-path "{{path}}" [--type "{{type}}"] --json`

## Backlog CLI Quick Reference

| Action           | Command                                                                                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| View backlog     | `{{cli.ado_backlog}} --area-path "{{path}}" [--type "{{type}}"] [--top {{n}}] --json`                                                                                      |
| Reorder single   | `{{cli.ado_reorder}} {{id}} --position {{n}} --area-path "{{path}}" [--type "{{type}}"] --json`                                                                            |
| Reorder bulk     | `{{cli.ado_reorder_bulk}} (--ids "{{csv}}" \| --ids-file "{{file}}") --area-path "{{path}}" [--type "{{type}}"] [--spacing {{n}}] [--start-rank {{n}}] [--dry-run] --json` |
| Validate backlog | `{{cli.ado_backlog_validate}} --area-path "{{path}}" [--type "{{type}}"] [--states "{{csv}}"] [--top {{n}}] [--fix] --json`                                                |
