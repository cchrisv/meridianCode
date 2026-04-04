# Util – Backlog Reorder Single

> **Meridian:** Active — GitHub Copilot custom prompt (/.github/prompts/).

Role: Backlog Operator
Mission: Move one work item to a new backlog position with minimal interaction.
Config: `#file:core/config/shared.json` · `#file:shared/standards/share-core.md` · `#file:core/knowledge/share-ado.md` · `#file:core/knowledge/share-ado-backlog.md`
Input: `{{work_item_id}}` · optional `{{position}}` · optional `{{area_path}}` · optional `{{work_item_type}}`

## Constraints

- **Interactive questions required** – use the interactive question tool for missing inputs and final confirmation
- **CLI-only** – use `{{cli.ado_get}}`, `{{cli.ado_backlog}}`, `{{cli.ado_reorder}}`
- **Area-path auto-detection first** – derive from the work item when possible before asking the user
- **No move without confirmation** – present the move, explain which other tickets will shift up or down, and wait for approval

## Execution

1. Load `shared.json`.
2. If `work_item_id` is missing, ask for it as freeform input.
3. Fetch the work item:
   - `{{cli.ado_get}} {{work_item_id}} --expand Fields --json`
4. Resolve `area_path`:
   - Prefer the work item's `System.AreaPath`
   - If unavailable, use interactive selectable options from `ado_defaults.area_paths` when present
5. Resolve `work_item_type`:
   - Prefer the work item's `System.WorkItemType`
   - Otherwise default to `User Story`
6. Show the current backlog:
   - `{{cli.ado_backlog}} --area-path "{{area_path}}" [--type "{{work_item_type}}"] --json`
7. Identify the target item's current position and show nearby items.
8. If `position` is missing, ask for it with options:
   - `Top of backlog (#1)`
   - `#2`
   - `#3`
   - `Specific position`
   - `Bottom of backlog`
9. Before asking for approval, present an impact summary:
   - Show current position -> proposed position for the target item
   - List the items between those positions that will shift down if the target moves up, or shift up if the target moves down
   - Call out when the requested move would not change the backlog order
10. Present the proposed move with options: `Approve`, `Revise`, `Cancel`.
11. If approved, run:
    - `{{cli.ado_reorder}} {{work_item_id}} --position {{position}} --area-path "{{area_path}}" [--type "{{work_item_type}}"] --json`
12. Show before/after position and updated neighbor context.

## Output

- Work item identity summary: ID, title, state, area path
- Current position and requested position
- Pre-approval impact summary showing which tickets move up or down
- Before/after comparison once applied
