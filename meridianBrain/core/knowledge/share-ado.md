# Share – ADO (Generic)

> **Meridian:** Active — Copilot `#file:core/knowledge/share-ado.md` on many prompts.

ADO foundation — context lifecycle, read-path CLI, field paths. Needed by any prompt that touches ADO.
References: `#file:config/core/share-core.md`
NEVER references Salesforce, wiki engine.

## ADO Guardrails

1. **No comments** – never post to work items unless explicitly requested
2. **Unified context only** – ALWAYS use `{{root}}/ticket-context.json`; NEVER separate artifacts
3. **No unauthorized state changes** – NEVER change `System.State` on an ADO work item unless the current prompt step explicitly names the target state AND the user has confirmed. Never set state as a side effect of re-running, reopening, correcting, or reverting a phase. If asked to "reopen" a ticket without specification of a target state, use the interactive question tool to ask which state to restore to before making any ADO call.

## Unified Context Paths

`{{root}}` = `{{paths.artifacts_root}}/{{work_item_id}}`
`{{context_file}}` = `{{root}}/ticket-context.json` (SINGLE SOURCE OF TRUTH)

| Phase        | Context Section |
| ------------ | --------------- |
| Research     | `.research`     |
| Grooming     | `.grooming`     |
| Solutioning  | `.solutioning`  |
| Finalization | `.finalization` |
| Dev Updates  | `.dev_updates`  |
| Closeout     | `.closeout`     |

## Context Structure

```json
{
  "metadata": {
    "work_item_id": "",
    "created_at": "",
    "last_updated": "",
    "current_phase": "research|grooming|solutioning_research|solutioning|finalization|complete",
    "phases_completed": [],
    "version": "1.0"
  },
  "run_state": {
    "completed_steps": [],
    "generation_history": [],
    "errors": [],
    "metrics": { "research": {}, "grooming": {}, "solutioning": {} }
  },
  "research": {},
  "grooming": {},
  "solutioning": {},
  "finalization": {},
  "dev_updates": {},
  "closeout": {}
}
```

**Valid `current_phase` values:** `research` · `grooming` · `solutioning_research` · `solutioning` · `finalization` · `complete`
**Valid `phases_completed` values:** `research` · `grooming` · `solutioning_research` · `solutioning` · `finalization`
Full schema: `#file:core/templates/ticket-context-schema.json`

## Phase map (ticket-context sections ↔ unified workflow)

Single entry prompt: **`workflow-initial-copilot-grooming.prompt.md`** (`/workflow-initial-copilot-grooming`). To reset and redo one section, use **`util-repeat-phase.prompt.md`** then re-invoke the unified workflow.

| Context section                   | Concern (unified) | Role                                   |
| --------------------------------- | ----------------- | -------------------------------------- |
| `research`                        | Discover          | Business research, wiki, related items |
| `grooming`                        | Refine            | Requirements what/why → ADO            |
| `solutioning` (research portions) | Solve (research)  | SF / platform technical discovery      |
| `solutioning` (design portions)   | Solve             | Solution design how → ADO              |
| `finalization`                    | Size + Publish    | WSJF, links, wrap-up                   |

## ADO Read CLI Quick Reference

| Action            | Command                                                                                                                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Init workflow     | `{{cli.workflow_prepare}} -w {{work_item_id}} --json`                                                                                                                                    |
| Check status      | `{{cli.workflow_status}} -w {{work_item_id}} --json`                                                                                                                                     |
| Get work item     | `{{cli.ado_get}} {{work_item_id}} --expand All --json`                                                                                                                                   |
| Get with comments | `{{cli.ado_get}} {{work_item_id}} --expand All --comments --json`                                                                                                                        |
| Search ADO        | `{{cli.ado_search}} --text "{{text}}" --all --json`                                                                                                                                      |
| Get relations     | `{{cli.ado_relations}} {{work_item_id}} --type {{types}} --json`                                                                                                                         |
| Link items        | `{{cli.ado_link}} {{sourceId}} {{targetId}} --type {{linkType}} --json` _(lowercase only: `related` \| `parent` \| `child` \| `predecessor` \| `successor` \| `duplicate` \| `affects`)_ |
| Unlink items      | `{{cli.ado_unlink}} {{sourceId}} {{targetId}} --type {{linkType}} --json` _(same lowercase enum)_                                                                                        |
| Iterations        | `{{cli.ado_iteration}} [--current] --json`                                                                                                                                               |
| Search wiki       | `{{cli.wiki_search}} "{{keywords}}" --json`                                                                                                                                              |

## Run State Update

After each stream, add to `run_state.completed_steps[]`:
`{"phase":"{{phase}}","step":"{{stream_name}}","completedAt":"{{timestamp}}","artifact":"{{context_file}}"}`

## Context Operations

- **Load:** `[IO]` read `{{context_file}}`
- **Update:** `[IO]` modify section → write `{{context_file}}`
- **Phase complete:** update `metadata.current_phase` + `metadata.phases_completed`
- Always validate schema after writes
