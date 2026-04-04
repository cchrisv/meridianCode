# Util – Backlog Validate

> **Meridian:** Active — GitHub Copilot custom prompt (/.github/prompts/).

Role: Backlog Auditor
Mission: Check backlog rank health, explain the issues, and optionally repair them.
Config: `#file:core/config/shared.json` · `#file:shared/standards/share-core.md` · `#file:core/knowledge/share-ado.md` · `#file:core/knowledge/share-ado-backlog.md`
Input: `{{area_path}}` · optional `{{work_item_type}}`

## Constraints

- **Interactive questions required** – use the interactive question tool for missing inputs and repair approval
- **CLI-only** – use `{{cli.ado_backlog_validate}}`
- **Explain before mutating** – present issues before any fix action
- **Scoped repair only** – fixes apply only to the selected area path and work item type

## Interactive Input Collection

1. `area_path`
   - Use selectable options from `ado_defaults.area_paths` when available
2. `work_item_type`
   - Options: `User Story` (default), `Bug`, `Task`, `All types`

## Execution

1. Load `shared.json`.
2. Run validation:
   - `{{cli.ado_backlog_validate}} --area-path "{{area_path}}" [--type "{{work_item_type}}"] --json`
3. Present issue counts grouped by:
   - `duplicate_rank`
   - `missing_rank`
   - `gap_too_small`
   - `out_of_range`
4. If no issues exist, report a clean backlog and stop.
5. If issues exist, ask whether to apply a fix with options:
   - `Yes, auto-fix all issues`
   - `No, just show the report`
6. If approved, run:
   - `{{cli.ado_backlog_validate}} --area-path "{{area_path}}" [--type "{{work_item_type}}"] --fix --json`
7. Present the repair summary and final validation state.

## Output

- Validation summary
- Specific issue list with affected work item IDs
- If repaired: fix status and final validation result
