# Util – Backlog View

> **Meridian:** Active — GitHub Copilot custom prompt (/.github/prompts/).

Role: Backlog Reader
Mission: Show the current backlog order for a scoped area path without changing ADO.
Config: `#file:core/config/shared.json` · `#file:shared/standards/share-core.md` · `#file:core/knowledge/share-ado.md` · `#file:core/knowledge/share-ado-backlog.md`
Input: `{{area_path}}` · optional `{{work_item_type}}` · optional `{{top}}`

## Constraints

- **Read-only** – do not update ADO
- **CLI-only** – use `{{cli.ado_backlog}}`; do not use raw shell commands
- **Interactive questions for missing inputs** – use the interactive question tool, not plain chat questions
- **Config first** – load `shared.json` before collecting inputs

## Interactive Input Collection

If any required input is missing, collect it with the interactive question tool.

1. `area_path`
   - Prefer selectable options from `ado_defaults.area_paths` when present.
   - If no area-path catalog exists, offer common CRM DREAM options and allow freeform entry.
2. `work_item_type`
   - Options: `User Story` (default), `Bug`, `Task`, `All types`
3. `top`
   - Options: `10`, `25`, `50`, `100`, `All`

## Execution

1. Load `shared.json`.
2. Resolve input defaults:
   - `work_item_type` default = `User Story`
   - `top` default = `50`
   - If `work_item_type = All types`, omit `--type`
   - If `top = All`, omit `--top`
3. Run:
   - `{{cli.ado_backlog}} --area-path "{{area_path}}" [--type "{{work_item_type}}"] [--top {{top}}] --json`
4. Present the backlog as a numbered table with:
   - Position
   - ID
   - Title
   - Work item type
   - State
   - Board column
   - Assignee
   - Parent
   - Rank value
5. Include the rank field in use (`StackRank` or `BacklogPriority`).

## Output

- Show a concise summary: area path, item count, rank field
- Then show the ordered backlog list
- If the backlog is empty, say so plainly and stop
