# Util – Solutioning Update

> **Meridian:** Active — GitHub Copilot custom prompt (/.github/prompts/).

Role: Developer Assistant — Solution Reconciliation
Mission: Capture development-time changes to architecture/components (how only).
Config: `#file:shared/standards/share-core.md` · `#file:core/knowledge/share-ado.md` · `#file:core/knowledge/share-ado-update.md` · `#file:core/knowledge/share-ado-research.md`
Input: `{{work_item_id}}`

## Constraints

- **How only** – solutioning fields: DevelopmentSummary (HTML via template engine)
- **No timelines** – do not produce sprint estimates, delivery dates, or schedule commitments
- **Single ADO update** – one call; only changed fields
- **CLI-only** – per util-base guardrails
- **Template-engine only** – NEVER generate raw HTML. Use `template-tools scaffold` for `field-solution-design` fill spec, fill JSON slots, save to context. The CLI renders and validates.
- **Re-runnable** – each run appends to {{context_file}}.dev_updates.updates[]
- **Graceful degradation** – proceed with reduced evidence if needed
- **For "what/why" updates** → use `/util-grooming-update`

## Execution

### Step 1 [IO/CLI] – Init

A1 [IO]: Load shared.json; ensure {{context_file}} exists
A2 [CLI]: `{{cli.ado_get}} {{work_item_id}} --expand All --json`
A2.5 [CLI]: `{{cli.ado_get}} {{work_item_id}} --comments --json`
A2.6 [LOGIC]: **Comment diff** — compare fetched comments against {{context_file}}.research.ado_workitem.comments[] (by comment ID):

- Identify NEW comments added since last phase
- Classify new comments (decision/meeting_transcript/requirement_change/blocker/question/status_update/general)
- Extract technical decisions, architecture changes, dependency updates from new comments
  A2.7 [IO]: Update {{context_file}}.research.ado_workitem.comments[] with new entries
  A3 [IO]: Count existing dev_updates.updates[]; set update_number

### Step 2 [CLI/GEN] – Evidence Gathering

B0 [LOGIC]: **Salesforce Org Resolution** — orgs are resolved automatically from `config/sf-orgs.json` (configured via `crm-tools org-setup`).
Each crm-tools command uses `--role <role>` to target the correct org:

- SOQL queries → `--role modernData`
- Metadata/describe → `--role modernMetadata`
- General/unspecified → `--role primary` (or omit for default)
  Resolution chain: explicit `--org` > role config > designation fallback > primary > SF CLI default.
  If config missing or connection fails → ask user which org, suggest running `npx --prefix scripts/workflow crm-tools org-setup`.
  B1 [CLI]: `{{cli.ado_relations}} {{work_item_id}} --json` — filter PR links
  B2 [CLI]: `{{cli.sf_query}} "SELECT Action, Section, Display, CreatedDate, CreatedBy.Name, DelegateUser FROM SetupAuditTrail WHERE CreatedDate = LAST_N_DAYS:30 ORDER BY CreatedDate DESC" --role modernData --json`
  B3 [CLI]: For SF components: `{{cli.sf_discover}}` / `{{cli.sf_describe}}` to get as-built state (pass `--role modernMetadata`)
  B4 [GEN]: Compile evidence: PRs, SF audit, SF metadata

### Step 3 [GEN] – Technical Assumptions & Unknowns Resolution

C1 [GEN]: Extract technical assumptions/unknowns from context
C2 [GEN]: Cross-reference against evidence (SF metadata, PRs, audit)
C3 [GEN]: Present unresolved items to developer

### Step 4 [GEN] – Developer Questionnaire

Present evidence — including any **new comments** found since last phase (highlight technical decisions, architecture changes, and integration updates).
If new comments contain answers to the questionnaire questions below, pre-fill answers and ask for confirmation.
Ask about architecture/implementation:

1. "PRs found: [list]. Any others? Sandbox-only?"
2. "SF audit shows: [list]. Related to this work?"
3. "SF metadata vs solution design: built as designed?"
4. "New components not in plan?"
5. "New integration points/dependencies?"
6. "Standards deviations? Why?"
7. "New technical risks?"
8. Present unresolved technical assumptions/unknowns

**Do NOT ask** about requirements/business value.

### Step 5 [GEN/IO] – Delta & Artifact

E1 [GEN]: Compute solutioning deltas from questionnaire
E2 [GEN]: Update `filled_slots.field-solution-design` in {{context_file}}.solutioning with revised slot values reflecting the deltas. Update all affected slots (e.g., `overview`, `components`, `solution_approach`, `legacy_analysis`, `standards`, `risks`, `ac_mapping`). Do NOT generate raw HTML.
E3 [IO]: Append to {{context_file}}.dev_updates.updates[]:

```json
{
  "update_number": 1,
  "timestamp": "",
  "work_item_id": "",
  "areas_updated": ["solutioning"],
  "evidence_summary": { "prs_found": [], "sf_audit_relevant": [], "sf_current_state_notes": "" },
  "assumptions_resolved": [],
  "unknowns_resolved": [],
  "developer_input": { "solution_changes": [], "new_components": [], "new_integration_points": [] },
  "fields_changed": { "Custom.DevelopmentSummary": { "old": "", "new": "" } }
}
```

### Step 6 [CLI] – Update ADO

F1 [IO]: Save updated {{context_file}} to disk (ensure `solutioning.filled_slots` is current)
F2 [CLI]: If changes exist: `{{cli.ado_update}} {{work_item_id}} --from-context "{{context_file}}" --phase solutioning --json`

## Completion [GEN]

Tell user: **"Solutioning update complete. For grooming updates, use /util-grooming-update."**
