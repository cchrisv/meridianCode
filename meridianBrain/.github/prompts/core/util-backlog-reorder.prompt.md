# Util – Backlog Reorder

> **Meridian:** Active — GitHub Copilot custom prompt (/.github/prompts/).

Role: Backlog Coordinator
Mission: Interactively inspect, reorder, and validate a backlog using the ADO backlog CLI commands.
Config: `#file:core/config/shared.json` · `#file:shared/standards/share-core.md` · `#file:core/knowledge/share-ado.md` · `#file:core/knowledge/share-ado-backlog.md`
Input: `{{area_path}}` · optional `{{work_item_id}}` · optional `{{ordered_ids}}` · optional `{{work_item_type}}`

## Constraints

- **Interactive questions required** – use the interactive question tool for all missing inputs and confirmation gates
- **CLI-only** – use `{{cli.ado_backlog}}`, `{{cli.ado_reorder}}`, `{{cli.ado_reorder_bulk}}`, `{{cli.ado_backlog_validate}}`
- **No blind mutations** – show the current backlog before any reorder, explain the positional impact, and require confirmation before any applied change
- **Scope** – operate within one area path at a time

## Interactive Input Collection

If inputs are missing, collect them in this order:

1. `area_path`
   - Use selectable options from `ado_defaults.area_paths` when available
2. `reorder_mode`
   - Options: `Move a single item to a position`, `Reorder multiple items (bulk)`, `Full backlog resequence`
3. `work_item_type`
   - Options: `User Story` (default), `Bug`, `Task`, `All types`
4. For single-item mode, collect `work_item_id` if missing
5. For single-item mode, collect target position
   - Options: `Top of backlog (#1)`, `Specific position`, `Bottom of backlog`
6. For bulk mode, if `ordered_ids` is missing:
   - First show the current backlog
   - Then ask the user for the desired ordered ID list as freeform text
7. For full resequence mode:
   - No custom ID order is needed; use the current backlog order and rewrite even spacing only

## Execution

1. Load `shared.json`.
2. Show the current backlog first:
   - `{{cli.ado_backlog}} --area-path "{{area_path}}" [--type "{{work_item_type}}"] --json`
3. Branch by mode:

### Single-item move

1. Confirm the target work item and requested position.
2. Before executing, compare the current backlog order to the requested target position and present an impact summary:
   - Show the target item's current position and proposed position
   - Show which items will shift down if the item moves up, or shift up if the item moves down
   - Call out when the move is a no-op because the item is already at the requested position
3. Ask for confirmation with options: `Apply`, `Revise`, `Cancel`.
4. If approved, run:
   - `{{cli.ado_reorder}} {{work_item_id}} --position {{position}} --area-path "{{area_path}}" [--type "{{work_item_type}}"] --json`
5. Show the resulting neighbor context and before/after position.

### Bulk reorder

1. Run a dry run first:
   - `{{cli.ado_reorder_bulk}} --ids "{{ordered_ids}}" --area-path "{{area_path}}" [--type "{{work_item_type}}"] --dry-run --json`
2. Compare the current backlog order to the dry-run order and present an impact summary before asking for approval:
   - List items that move up, with old position -> new position
   - List items that move down, with old position -> new position
   - Highlight unchanged items only when needed for clarity
   - Use the dry-run output plus the current backlog snapshot to explain the net positional effect, not just the rank assignments
3. Ask for confirmation with options: `Apply`, `Revise`, `Cancel`.
4. If approved, run without `--dry-run`.

### Full backlog resequence

1. Use the current backlog ID order.
2. Explain the impact before approval:
   - If only rank spacing will be rewritten and ticket positions stay the same, say that explicitly
   - If any position would change, list the items moving up or down before continuing
3. Ask for confirmation with options: `Apply`, `Cancel`.
4. Run bulk reorder with the current ordered IDs and default spacing.

5. After any applied change, show the updated backlog:
   - `{{cli.ado_backlog}} --area-path "{{area_path}}" [--type "{{work_item_type}}"] --json`
6. Validate rank health:
   - `{{cli.ado_backlog_validate}} --area-path "{{area_path}}" [--type "{{work_item_type}}"] --json`

## Output

- Current backlog snapshot
- Planned or applied changes
- Impact summary showing which tickets move up or down before each approval gate
- Updated backlog snapshot when a change was applied
- Validation status and issues, if any
