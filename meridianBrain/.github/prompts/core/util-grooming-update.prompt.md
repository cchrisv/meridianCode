# Util – Grooming Update

> **Meridian:** Active — GitHub Copilot custom prompt (/.github/prompts/).

Role: Developer Assistant — Requirements Reconciliation
Mission: Capture development-time changes to requirements/scope (what/why only).
Config: `#file:shared/standards/share-core.md` · `#file:core/knowledge/share-ado.md` · `#file:core/knowledge/share-ado-update.md` · `#file:core/knowledge/share-ado-research.md`
Input: `{{work_item_id}}`

## Constraints

- **What/Why only** – grooming fields: Description, AC, Tags, classification
- **Single ADO update** – one call; only changed fields
- **CLI-only** – per util-base guardrails
- **Re-runnable** – each run appends to {{context_file}}.dev_updates.updates[]
- **Graceful degradation** – proceed with reduced evidence if needed
- **For "how" updates** → use `/util-solutioning-update`

## Execution

### Step 1 [IO/CLI] – Init

A1 [IO]: Load shared.json; ensure {{context_file}} exists
A2 [CLI]: `{{cli.ado_get}} {{work_item_id}} --expand All --json`
A2.5 [CLI]: `{{cli.ado_get}} {{work_item_id}} --comments --json`
A2.6 [LOGIC]: **Comment diff** — compare fetched comments against {{context_file}}.research.ado_workitem.comments[] (by comment ID):

- Identify NEW comments added since research phase
- Classify new comments using context_type taxonomy (decision/meeting_transcript/requirement_change/blocker/question/status_update/general)
- Extract key decisions, scope changes, requirements discussions from new comments
  A2.7 [IO]: Update {{context_file}}.research.ado_workitem.comments[] with new entries
  A3 [IO]: Count existing dev_updates.updates[]; set update_number

### Step 2 [CLI/GEN] – Evidence Gathering

B1 [CLI]: `{{cli.ado_relations}} {{work_item_id}} --json` — filter PR links
B2 [LOGIC]: Review ADO change history for grooming fields
B3 [GEN]: Compile scope-focused evidence summary

### Step 3 [GEN] – Assumptions & Unknowns Resolution

C1 [GEN]: Extract requirements assumptions/unknowns from context
C2 [GEN]: Cross-reference against evidence
C3 [GEN]: Present unresolved items to developer

### Step 4 [GEN] – Developer Questionnaire

Present evidence — including any **new comments** found since last research phase (highlight decisions, scope changes, and meeting transcripts).
If new comments contain answers to the questionnaire questions below, pre-fill answers and ask for confirmation.
Ask about requirements/scope:

1. "Requirements delivered: [list]. Accurate?"
2. "Done When / acceptance criteria lines added, removed, or modified?"
3. "Business requirements changed?"
4. "Items descoped/added? Business rationale?"
5. "Effort/risk level change?"
6. Present unresolved assumptions/unknowns

**Do NOT ask** about architecture/implementation.

### Step 5 [GEN/IO] – Delta & Artifact

E1 [GEN]: Compute grooming deltas from questionnaire
E2 [GEN]: Produce updated field values (what/why only)
E3 [IO]: Append to {{context_file}}.dev_updates.updates[]:

```json
{
  "update_number": 1,
  "timestamp": "",
  "work_item_id": "",
  "areas_updated": ["grooming"],
  "evidence_summary": { "prs_found": [], "scope_changes_detected": "" },
  "assumptions_resolved": [],
  "unknowns_resolved": [],
  "developer_input": { "scope_changes": [], "ac_changes": [], "effort_risk_changes": [] },
  "fields_changed": { "System.Description": { "old": "", "new": "" } }
}
```

### Step 6 [CLI] – Update ADO

F1 [IO]: Extract changed fields; save to temp file
F2 [CLI]: If changes exist: `{{cli.ado_update}} {{work_item_id}} --fields-file "<temp_payload>" --json`

## Completion [GEN]

Tell user: **"Grooming update complete. For solutioning updates, use /util-solutioning-update."**
