# Share – ADO Update

> **Meridian:** Active — Copilot `#file:core/knowledge/share-ado-update.md` (ADO writes, templates).

Patterns for writing to ADO — template engine, slot filling, field updates, state management.
References: `#file:config/platform-ado/share-ado.md` → `#file:config/core/share-core.md`
NEVER references Salesforce, research patterns, comment mining.

## ADO Update Guardrails

1. **Template-engine only** – NEVER generate raw HTML. Run `template-tools scaffold-phase` `[CLI]` to get a fill spec, then the AI fills slot values in the JSON `[GEN]` (there is NO `fill-slots` CLI command), saves to context `[IO]`, then `ado-tools update --from-context` `[CLI]` auto-renders, validates, and pushes. The AI only produces structured JSON, never HTML. Note: `type: "html"` slots (see schema below) accept pre-rendered HTML from template-tools or CLI output only — never author new HTML directly.
2. **Requirement type first for User Stories** – If a phase is filling User Story description or acceptance-criteria templates, determine `requirement_type` (`functional|technical`) before listing or scaffolding templates. Use stored `grooming.classification.requirement_type` when available; otherwise infer it from the requirement content.
3. **Fill slots, not HTML** – When populating ADO fields that have templates, write filled slot values to `{{context_file}}.{{phase}}.filled_slots`, then let the CLI render and validate.
4. **No unauthorized state changes** – per share-ado guardrails.

## Template-Engine Workflow (scaffold → fill → push)

```
1. [CLI]  template-tools scaffold-phase → JSON fill spec (slot shapes the AI must fill).
          For User Story Description/AC phases, classify requirement_type first and pass --requirement-type.
2. [GEN]  AI fills slot values in JSON (text, lists, tables, blocks) — NO raw HTML.
          ⚠ There is NO "fill-slots" CLI command — this is AI reasoning, not a tool call.
3. [IO]   Save filled slots to {{context_file}}.{{phase}}.filled_slots
4. [CLI]  ado-tools update --from-context → auto-renders, validates, pushes to ADO
```

Note: `template-tools render-phase` exists for standalone rendering but is NOT needed when using `--from-context` (which auto-renders internally).

## FillSlot Object Schema

Every entry in `filled_slots` must be a typed FillSlot object — plain strings or raw arrays are silently rejected and produce `Cannot read properties of undefined` errors at render time.

| Slot type          | Required shape                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| `text`             | `{ "variable": "slot_name", "type": "text", "value": "string" }`                               |
| `html`             | `{ "variable": "slot_name", "type": "html", "value": "<p>...</p>" }` — accepts pre-rendered HTML from template-tools or CLI output only; never author new HTML directly. |
| `list`             | `{ "variable": "slot_name", "type": "list", "items": ["item1", "item2"] }`                     |
| `table`            | `{ "variable": "slot_name", "type": "table", "rows": [{ "col_key": "value" }] }`               |
| `repeatable_block` | `{ "variable": "slot_name", "type": "repeatable_block", "blocks": [{ "slot_key": "value" }] }` |

The scaffold-phase output always shows the slot type for each field — use it as the authoritative reference for a given template.

## Template CLI Quick Reference

| Action              | Command                                                                                                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| List templates      | `{{cli.template_list}} --phase {{phase}} --type "{{work_item_type}}" [--requirement-type "{{requirement_type}}"] --json`                                                          |
| Scaffold phase      | `{{cli.template_scaffold_phase}} --phase {{phase}} --type "{{work_item_type}}" [--requirement-type "{{requirement_type}}"] -w {{work_item_id}} --context {{context_file}} --json` |
| Render phase        | `{{cli.template_render_phase}} --phase {{phase}} -w {{work_item_id}} --context {{context_file}} --json`                                                                           |
| Validate template   | `{{cli.template_validate}} --template {{key}} --rendered {{file}} --json`                                                                                                         |
| Template info       | `{{cli.template_info}} --template {{key}} --json`                                                                                                                                 |
| Update work item    | `{{cli.ado_update}} {{work_item_id}} --fields-file "{{file}}" --json`                                                                                                             |
| Update from context | `{{cli.ado_update}} {{work_item_id}} --from-context {{context_file}} --phase {{phase}} --json`                                                                                    |
| Reset phase         | `{{cli.workflow_reset}} -w {{work_item_id}} --phase {{phase}} --force --json`                                                                                                     |

For User Story phases that render Description or Acceptance Criteria, include `--requirement-type "{{requirement_type}}"` after classification so the template engine selects the functional or technical template family correctly.

## ADO Update Safety

Before any `ado_update` call:

1. Fetch current `System.Rev` from the work item → store as `rev_before`.
   After `ado_update`:
2. Extract `System.Rev` from response → `rev_after`.
3. If `rev_after == rev_before` → warn: "Update may not have persisted."
4. If update fails with 409 Conflict → re-fetch work item, re-apply changes, retry once.

## Field Update Patterns

- **Template-rendered fields:** use `--from-context` (auto-renders + pushes)
- **Raw field updates:** use `--fields-file <json>` with `{"fields":{...}}`
- **Extra fields format:** use short keys (e.g., `story_points`, `priority`), not full field paths
- **Single field:** use `--field <path> --value <val>` or `--value-file`
- **Metadata-only publish (no templates):** if `publish.filled_slots` would be empty — e.g., the phase only needs to push story points, priority, and tags — skip `--from-context` entirely. The CLI will error with `publish.filled_slots not found in context file` when `filled_slots` is `{}`. Use direct flags instead:
  ```
  {{cli.ado_update}} {{work_item_id}} --story-points {{n}} --priority {{n}} --tags "tag1 ; tag2" --json
  ```

## Tag Management

When updating tags:

1. Fetch current tags → split by semicolon → trim whitespace
2. Add new tags (dedup against existing)
3. Join with `;` separator
4. Update via `--tags` flag
