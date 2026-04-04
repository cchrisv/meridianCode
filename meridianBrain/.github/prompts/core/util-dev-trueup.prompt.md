# Util – Dev True-Up

> **Meridian:** Active — GitHub Copilot custom prompt (/.github/prompts/).

Role: Development Reconciliation Coordinator
Mission: Reconcile planned vs actual after development; update ADO fields and context with as-built reality. Standalone utility — no prior grooming phases required.
Config: `#file:shared/standards/share-core.md` · `#file:core/knowledge/share-ado.md` · `#file:core/knowledge/share-ado-update.md` · `#file:core/knowledge/share-ado-research.md`
Input: `{{work_item_id}}`

## Overview

Dev True-Up is a **standalone utility** that compares what was planned against what was actually built. It works on any ADO work item — whether it went through the full grooming pipeline or not. It discovers PRs, analyzes diffs, queries Copado deployment evidence, conducts a developer interview, updates grooming and solutioning fields with as-built reality, generates release notes, and pushes everything to ADO.

**No prior phases required.** The utility fetches all needed context directly from ADO and Salesforce. If a `ticket-context.json` exists from prior grooming phases, it uses that as additional context — but it works without it.

## Constraints

- **CLI-only** – per util-base guardrails
- **Template-engine only** – NEVER generate raw HTML. Use `template-tools scaffold-phase` for fill specs, fill JSON slots, save to context. The CLI renders and validates.
- **FillSlot format** – Each slot in `filled_slots` MUST be a full FillSlot object: `{ "variable": "name", "type": "text|html|table|list", "required": true|false, "hint": "...", "value": "...", "items": [], "rows": [] }`. NEVER write raw string values. For optional `html` slots with no content, set `value` to a short placeholder like `"<li>None</li>"` (empty string leaves unfilled tokens). Copy the structure from `template-tools scaffold` output.
- **extra_fields format** – Use short keys: `"tags"` (array of strings), `"story_points"` (number). Do NOT use ADO field paths like `System.Tags` or `Microsoft.VSTS.Scheduling.StoryPoints`.
- **Graceful degradation** – proceed with reduced evidence if context file or prior phases are missing
- **Tag**: append {{tags.dev_complete}} to tags
- **Unified context only** – outputs to {{context_file}}.closeout.\*
- **Interactive** – this is a collaborative process, NOT a batch job. The agent MUST pause at every `[GATE]` step and wait for user confirmation before proceeding. Never auto-advance past a gate. Present findings clearly and ask focused questions.
- **Single ADO update** – one combined payload
- **Preserve investigation trail** – add as-built alongside planned

## Templates

Templates are managed by the template engine. Use `template-tools scaffold-phase --phase closeout` to get fill specs for:

- `field-solution-design` — ADO Development Summary HTML
- `field-bug-root-cause-detail` — Root Cause Detail HTML (Bug/Defect only)
- `field-release-notes` — ADO Release Notes HTML
- Grooming field templates (description, AC, etc.) per work item type and, for User Stories, the stored `grooming.classification.requirement_type`

## Execution

### Step 1 [IO/CLI] – Init & Context Discovery

A1 [IO]: Load shared.json
A2 [CLI]: `{{cli.ado_get}} {{work_item_id}} --expand All --comments --json`
A3 [IO]: Check if {{context_file}} exists. If yes, load it for additional context (research, grooming, solutioning findings). If no, proceed without — all evidence will come from ADO and Salesforce directly.
A3.1 [LOGIC]: **Grooming-skip check** — if {{context_file}} was loaded and `metadata.phases_completed` does NOT include `"grooming"`, use the interactive question tool to present this warning: _"This work item has not been through Phase 02 Grooming. Dev true-up will regenerate Description and Acceptance Criteria from scratch using PR evidence and ADO content only — the groomed requirements will be missing context from the grooming phase. Continue anyway, or stop and run Phase 02 Grooming first?"_

- `Continue — build from PR evidence and ADO content` — proceed; log `"grooming_skipped": true` to `closeout.questionnaire`
- `Stop — run Phase 02 Grooming first` — halt execution; direct user to `/workflow-initial-copilot-grooming {{work_item_id}}` (Refine / grooming) or ensure grooming is complete in context first
  A4 [LOGIC]: Extract current state from ADO — work item type, title, description, acceptance criteria, development summary, tags, story points, state, assigned to
  A4.5 [LOGIC]: **Salesforce Org Resolution:** per share-salesforce § Salesforce Org Resolution
  A5 [LOGIC]: Extract child IDs from relations (`System.LinkTypes.Hierarchy-Forward`)
  A6 [CLI]: Per child: `{{cli.ado_get}} {{child_id}} --expand Relations --comments --json`
  A8 [GEN]: Per child: extract state, key fields, classify comments (decisions, scope changes, lessons learned)
  A9 [GEN]: **Comment mining** across all comments (self + children):
- Final decisions made during development
- Scope changes documented in discussions
- Meeting transcripts and action item resolutions
- Lessons learned mentioned in comments
- Blocker resolutions

### Step 2 [CLI/GEN] – Evidence Gathering

#### 2a – PR Discovery & Deep Analysis

B1 [CLI]: `{{cli.pr_list}} --work-item {{work_item_id}} --json` — discover all PRs linked to this work item
B1.1 [CLI]: Per child work item: `{{cli.pr_list}} --work-item {{child_id}} --json` — discover PRs linked to children too
B1.2 [LOGIC]: Deduplicate PR list (same PR may link to parent and child)

B1.3 [CLI]: **Per PR** (parallel-safe across PRs):

- `{{cli.pr_get}} --url "{{pr_url}}" --json` → metadata: title, author, status, branches, reviewers with votes, merge status
- `{{cli.pr_diff}} --url "{{pr_url}}" --mode context --json` → file changes with `sourceContent` (full file for context) + `unifiedDiff` (what changed). Use `--max-files 50`.
- `{{cli.pr_threads}} --url "{{pr_url}}" --json` → reviewer comment threads with file positions, authors, resolution status

B1.4 [GEN]: **Per-PR analysis** — for each PR:

- **Change inventory**: list every file changed, classify by type (Apex class, trigger, LWC, Flow, metadata, config, test)
- **Change summary**: what logic was added/modified/removed per file (use `unifiedDiff` for specifics, `sourceContent` for surrounding context)
- **Reviewer feedback synthesis**: extract key themes from comment threads — concerns raised, questions answered, requested changes, approvals
- **Map to components**: match changed files to known components where possible

B1.5 [GEN]: **Cross-PR synthesis** — across all PRs:

- Aggregate all changed files into a single inventory (note which PR introduced each change)
- Identify patterns: components touched by multiple PRs, incremental evolution of the same files
- Build a comprehensive picture of what was actually built vs what was planned

#### 2b – Salesforce & ADO Evidence

B2 [CLI]: `{{cli.sf_query}} "SELECT Action, Section, Display, CreatedDate, CreatedBy.Name, DelegateUser FROM SetupAuditTrail WHERE CreatedDate = LAST_N_DAYS:90 ORDER BY CreatedDate DESC" --role modernData --json`
B3 [CLI]: `{{cli.sf_discover}}` / `{{cli.sf_describe}}` on SF components (pass `--role modernData`)
B4 [LOGIC]: Extract ADO revision history
B4.5 [GEN]: **Child reconciliation** — compare child states against planned components (if context exists):

- Map children to known components where possible
- Identify: completed children, modified children, new children not in plan, removed/cancelled children
- Use child comments + states as evidence for planned-vs-actual delta

#### 2c – Copado Deployment Evidence

Copado tracks the full deployment pipeline in Salesforce. Query the **production org** (`--role modernData`) for deployment evidence.

B5 [CLI]: **Find Copado User Story** linked to this ADO work item:
`{{cli.sf_query}} "SELECT Id, Name, copado__Status__c, copado__Apex_Code_Coverage__c, copado__Last_Promotion_Date__c, copado__Metadata_Types_in_Selection__c, copado__Developer__c, copado__Environment__r.Name FROM copado__User_Story__c WHERE Link_to_Azure_Item__c LIKE '%{{work_item_id}}%'" --role modernData --json`

B5.1 [LOGIC]: If no Copado User Story found → log and continue (graceful degradation). Not all work items have Copado records.
B5.2 [LOGIC]: If found → store `copado_us_id` and proceed with sub-queries.

B6 [CLI]: **Deployment pipeline** — promotions showing environment-to-environment progression:
`{{cli.sf_query}} "SELECT Id, Name, copado__Promotion__r.Name, copado__Promotion__r.copado__Status__c, copado__Promotion__r.copado__Source_Environment__r.Name, copado__Promotion__r.copado__Destination_Environment__r.Name, copado__Promotion__r.copado__Project__r.Name, copado__Promotion__r.CreatedDate FROM copado__Promoted_User_Story__c WHERE copado__User_Story__c = '{{copado_us_id}}' ORDER BY copado__Promotion__r.CreatedDate ASC" --role modernData --json`

B7 [CLI]: **Metadata selections** — exact components tracked in Copado:
`{{cli.sf_query}} "SELECT Id, Name, copado__Type__c, copado__ModuleDirectory__c, copado__Last_Commit_Date__c FROM copado__User_Story_Metadata__c WHERE copado__User_Story__c = '{{copado_us_id}}'" --role modernData --json`

B8 [CLI]: **Commits** — git commit references:
`{{cli.sf_query}} "SELECT Id, Name, copado__Status__c, CreatedDate FROM copado__User_Story_Commit__c WHERE copado__User_Story__c = '{{copado_us_id}}' ORDER BY CreatedDate DESC" --role modernData --json`

B9 [GEN]: **Copado analysis:**

- **Deployment timeline**: reconstruct the promotion path (e.g., Dev → QA → Staging → Production) with dates and statuses
- **Failed/validation promotions**: flag any promotions with non-Completed status (Validation, Failed, Cancelled)
- **Back-promotions**: identify back-promotions and note which environments received them
- **Component cross-reference**: compare Copado metadata selections against PR file inventory from Step 2a — they should align
- **Coverage**: note the `copado__Apex_Code_Coverage__c` percentage as deployment-time test coverage
- **Production deployment date**: extract the CreatedDate of the promotion to Production as the actual deployment date

#### 2d – Evidence Compilation

B10 [GEN]: Compile all evidence sources into unified view:

- **PR evidence** (primary): file-level changes, reviewer feedback, merge status — this is the most accurate record of what was actually built
- **Copado deployment evidence**: promotion pipeline (environments, dates, statuses), metadata selections, test coverage — confirms what was deployed where and when
- **SF audit trail**: setup changes confirming deployed configuration
- **SF as-built vs planned**: metadata comparison against prior plan (if context exists)
- **Child reconciliation**: task completion status mapped to components

### Step 3 [GATE] – Evidence Review

Present a structured summary to the user for validation. **Do NOT proceed until the user confirms.**

C1 [GEN]: Present the following to the user:

**3a — PRs discovered:**

- List each PR: #, title, author, status, branch → target, file count
- Flag any surprises: PRs from unexpected authors, PRs targeting unexpected branches, PRs still open/abandoned
- Ask: _"Are these all the PRs for this work? Any missing?"_

**3b — Key changes found** (high-level, not file-by-file yet):

- Summarize what was built per PR in 2-3 sentences each
- Highlight reviewer concerns/themes from threads
- Ask: _"Does this match your understanding of what was done?"_

**3c — Copado deployment pipeline** (if Copado User Story found):

- Show: Copado User Story name, status, apex code coverage %
- Show deployment timeline: each promotion as Source → Destination (Status) on Date
- Flag any failed or validation-stuck promotions
- Flag back-promotions and their target environments
- Show production deployment date
- Cross-reference: Copado metadata selections vs PR file inventory — flag any mismatches
- Ask: _"Does this deployment history look correct? Any environments missing?"_

**3d — Gaps & questions:**

- Planned components with NO PR evidence — ask if these were config-only, sandbox-only, or descoped
- PR changes NOT mapped to any planned component — ask the user to classify (scope addition, tech debt, dependency, etc.)
- Copado metadata not matching PR files (or vice versa) — ask user to explain discrepancy
- Sandbox-only or manual changes not captured in PRs/audit
- Ask: _"Anything else that was done that I haven't picked up?"_

C2 [LOGIC]: **WAIT** for user response. Incorporate corrections before proceeding.
C3 [LOGIC]: If user identifies missing PRs or work → go back to Step 2a to fetch additional PR data.

### Step 4 [GEN/ASK] – Developer Interview (Iterative)

This is a **conversation loop**, not a one-shot questionnaire. Ask focused questions in batches of 2-4. Iterate until the user confirms all items are resolved.

**Round 1 — Assumptions & unknowns:**
D1 [GEN]: Extract all assumptions + unknowns from context (if context file exists) or from ADO comments/description
D2 [GEN]: Cross-reference against PR evidence — auto-resolve items where PR diffs provide conclusive answers
D3 [ASK]: Present remaining unresolved items to user, grouped by topic. For each: state what you found (or didn't), ask for resolution.

- _"I found [N] assumptions and [N] unknowns. [N] were resolved by PR evidence. Here are the remaining [N]:"_
- List each with current status and what evidence was checked
- Ask: _"Can you resolve these?"_
  D4 [LOGIC]: **WAIT** — do not proceed until all items are Resolved or Confirmed.

**Round 2 — Effort & outcomes:**
D5 [ASK]: Ask the user:

- _"What was the final effort level? (story points, complexity)"_
- _"Were there any test results or QA findings to note?"_
- _"Any lessons learned from this work?"_
- (Bug/Defect only) _"What was the confirmed root cause? Any corrections to the root cause category or contributing factors?"_

**Round 3 — Follow-up & loose ends:**
D6 [ASK]: Ask the user:

- _"Does this work need any follow-up tickets? (tech debt, phase 2, known limitations)"_
- _"Anything else I should capture before I build the true-up?"_

D7 [LOGIC]: **WAIT** — confirm all rounds are complete before proceeding.

### Step 5 [GEN/GATE] – Delta Analysis

Build planned-vs-actual from interview responses + evidence + resolved items.

**PR-driven delta** — the PR diffs from Step 2a are the primary source of truth for what was actually built:

- For each planned component (if known): was it changed in a PR? Which files? What was the actual implementation approach?
- For each PR file change NOT mapped to a planned component: classify as scope addition, technical debt, refactoring, or dependency
- Note any planned components with NO PR evidence (may be config-only, sandbox-only, or descoped)
- Use reviewer thread themes to capture implementation decisions not documented elsewhere

**Copado-corroborated delta** — use Copado data from Step 2c to validate and enrich:

- Cross-reference Copado metadata selections against PR file inventory — confirm what was actually deployed vs just committed
- Use promotion pipeline dates to establish deployment timeline: when each environment received the changes
- Use `copado__Apex_Code_Coverage__c` as the deployment-time code coverage figure
- Note any discrepancies between PR scope and Copado deployment scope (e.g., metadata in Copado not in PR, or vice versa)

**Present delta to user for validation:**

- Show planned-vs-actual component table: planned name → actual files → status (delivered / modified / added / descoped)
- Show scope changes: what was added, removed, or modified vs original plan
- Show acceptance criteria mapping: which ACs were met, partially met, or not addressed
- Ask: _"Does this delta accurately reflect what happened? Any corrections?"_
- **WAIT** for confirmation before proceeding.

### Step 6 [GEN] – Update Grooming

Regenerate grooming fields with final requirements (what was delivered). **What/why only**.
Append {{tags.dev_complete}} to tags.

### Step 7 [GEN] – Update Solutioning

G1 [GEN]: Regenerate solution design with as-built architecture. **How only**.

- Use PR diff analysis from Step 2a as primary evidence: actual files changed, methods added/modified, classes created
- Incorporate reviewer feedback themes that informed implementation decisions
- Reconcile planned component list with actual PR file inventory
  G2 [GEN]: Prepare as-built solution design data for template rendering in Step 8.
  G3 [IO]: Save technical spec → {{context_file}}.closeout.technical_spec_final

### Step 8 [GEN/CLI] – Update Developer Summary

H1 [CLI]: `{{cli.template_scaffold_phase}} --phase closeout --type "{{work_item_type}}" -w {{work_item_id}} --context {{context_file}} --json` — get fill spec for `field-solution-design`
H2 [GEN]: Fill slot values using the **scaffold output as the base structure** — copy each FillSlot object and set `value` (for text/html), `items` (for list), or `rows` (for table). Do NOT replace FillSlot objects with raw strings. Fill from `closeout.delta` (as-built components, scope changes), `closeout.solutioning_final` (solution_design, architecture_decisions), and `closeout.pr_analysis` (PR diffs and reviewer feedback):

- `business_problem_statement` — refined from delivered scope
- `solution_approach_narrative` — as-built approach reflecting actual implementation, informed by PR diff evidence
- `technical_narrative` — **html type**: emit structured HTML, NOT a wall of text. Use `<p style="...">` for paragraphs, `<div style="font-weight:600; ...">` for subsection labels, and `<ul style="..."><li>...</li></ul>` for lists. Break the narrative into logical subsections (e.g., Trigger & Entry Criteria, Processing Logic, Error Handling). Reference specific code changes from PR diffs to ground the narrative in what was actually shipped. Example structure:
  ```html
  <div style="font-weight: 600; color: #495057; margin-bottom: 8px;">Trigger & Entry Criteria</div>
  <p style="margin: 0 0 12px 0;">
    The flow trigger was expanded from Update-only to CreateAndUpdate...
  </p>
  <div style="font-weight: 600; color: #495057; margin: 12px 0 8px 0;">Processing Logic</div>
  <ul style="margin: 0 0 12px 0; padding-left: 20px;">
    <li>Decision element routes to New User vs Role Change path</li>
    <li>Duplicate prevention queries existing memberships</li>
  </ul>
  ```
- `components` — reconciled component table from closeout delta, cross-referenced with PR file inventories for accuracy
- `integration_points_brief` — as-built integration points, validated against PR evidence
  H2.5 [GEN]: **Root cause true-up** (Bug/Defect only) — if `work_item_type` is Bug or Defect, fill `field-bug-root-cause-detail` slot values from scaffold output:
- Compare any prior root cause hypothesis against actual findings from PR diffs, developer interview, and SF evidence
- Update `root_cause_summary` with confirmed root cause (or build from scratch if no prior hypothesis exists)
- Update `root_cause_category` based on evidence classification
- Set `confidence_level` to `"Confirmed"` (PR evidence validates), `"Probable"` (strongly supported but not conclusive), or `"Hypothesis"` (if insufficient evidence)
- Update `contributing_factors_items` with confirmed factors from actual code changes
- Update `evidence_references` with PR numbers, specific file changes, reviewer feedback, and deployment evidence
  H3 [IO]: Save filled_slots → {{context_file}}.closeout.filled_slots
  H4 [IO]: Save to disk — **GATE: do not proceed until confirmed written.**

### Step 9 [GEN] – Release Notes

Build polished release note for field_paths.release_notes using field_release_notes template.
**Audience:** end users, stakeholders, QA — not developers.
**Sections:** Summary, What's New/Changed, Impact, Known Limitations (optional), Related Items (optional).

**PR-informed accuracy** — use the PR diff analysis from Step 2a to ensure release notes accurately describe what changed:

- Ground "What's New/Changed" in actual code changes, not just planned requirements
- If a PR introduced something not in the original plan, include it
- If a planned feature was descoped (no PR evidence), do NOT include it in release notes
- Use reviewer threads to identify any known limitations or caveats flagged during review

**Copado deployment context** — use Copado evidence from Step 2c to enrich release notes:

- Include the production deployment date from the Copado promotion pipeline
- Reference the deployment-time Apex code coverage percentage
- Note the deployment environments traversed (e.g., "Deployed through Dev → QA → Staging → Production")

### Step 9.5 [GATE] – Content Review

Present ALL generated content to the user for review before saving the artifact or updating ADO. **Do NOT proceed until the user approves.**

I1 [GEN]: Present the following sections for user review:

**9.5a — Grooming fields** (from Step 6):

- Show updated Description, Acceptance Criteria, and any other grooming fields
- Highlight what changed from the previous version
- Ask: _"Do these grooming fields accurately reflect what was delivered?"_

**9.5b — Solution design** (from Step 7):

- Show the as-built solution design narrative and component list
- Ask: _"Does this technical summary accurately describe how it was built?"_

**9.5c — Developer summary** (from Step 8):

- Show each filled slot value (business problem, solution approach, technical narrative, components, integration points)
- Ask: _"Any corrections to the developer summary?"_

**9.5d — Release notes** (from Step 9):

- Show the full release note content
- Ask: _"Are these release notes accurate and appropriate for stakeholders?"_

**9.5e — Root cause detail** (Bug/Defect only, from Step 8):

- Show root cause summary, category, confidence level, contributing factors, and evidence references
- Highlight what changed from any prior hypothesis (e.g., "Hypothesis → Confirmed", category change, new contributing factors)
- Ask: _"Does this root cause analysis accurately capture what caused the issue?"_

I2 [LOGIC]: **WAIT** for user response.
I3 [LOGIC]: If user requests changes → revise the affected sections (Steps 6–9 as needed) and re-present.
I4 [LOGIC]: **Loop** until user confirms all sections are approved.

### Step 10 [IO] – Artifact

Save → {{context_file}}.closeout:

```json
{
  "questionnaire": {},
  "pr_analysis": {
    "pull_requests": [
      {
        "pr_id": 0,
        "repo": "",
        "title": "",
        "author": "",
        "status": "",
        "source_branch": "",
        "target_branch": "",
        "files_changed": [{ "path": "", "change_type": "", "component_mapped": "" }],
        "change_summary": "",
        "reviewer_feedback_themes": [],
        "linked_work_item_ids": []
      }
    ],
    "cross_pr_file_inventory": [],
    "unmapped_changes": [],
    "reviewer_decisions": []
  },
  "copado_evidence": {
    "user_story": {
      "id": "",
      "name": "",
      "status": "",
      "apex_code_coverage": 0,
      "developer": "",
      "environment": "",
      "last_promotion_date": "",
      "metadata_types": ""
    },
    "promotion_pipeline": [
      {
        "promotion_name": "",
        "status": "",
        "source_environment": "",
        "destination_environment": "",
        "project": "",
        "date": "",
        "is_back_promotion": false
      }
    ],
    "metadata_selections": [{ "name": "", "type": "", "last_commit_date": "" }],
    "commits": [{ "name": "", "status": "", "date": "" }],
    "production_deployment_date": "",
    "environments_traversed": []
  },
  "delta": {
    "components": [],
    "acceptance_criteria": [],
    "scope_changes": { "added": [], "removed": [], "modified": [] },
    "effort_final": { "story_points": 0, "effort_level": "" },
    "lessons_learned": [],
    "follow_up_work_items": []
  },
  "assumptions_resolved": [],
  "unknowns_resolved": [],
  "grooming_final": { "fields": {} },
  "solutioning_final": { "solution_design": {}, "development_summary_html": "" },
  "filled_slots": {
    "field-solution-design": {
      "business_problem_statement": {
        "variable": "business_problem_statement",
        "type": "text",
        "required": true,
        "hint": "...",
        "value": "FILLED VALUE HERE",
        "items": [],
        "rows": []
      },
      "solution_approach_narrative": {
        "variable": "solution_approach_narrative",
        "type": "text",
        "required": true,
        "hint": "...",
        "value": "FILLED VALUE HERE",
        "items": [],
        "rows": []
      },
      "technical_narrative": {
        "variable": "technical_narrative",
        "type": "html",
        "required": true,
        "hint": "Structured HTML with subsection labels, paragraphs, and bullet lists",
        "value": "<div style='font-weight:600;color:#495057;margin-bottom:8px;'>Section Title</div><p style='margin:0 0 12px 0;'>Details...</p>",
        "items": [],
        "rows": []
      },
      "components": {
        "variable": "components",
        "type": "table",
        "required": true,
        "hint": "...",
        "value": null,
        "items": [],
        "rows": [{ "name": "MyClass", "type": "Apex Class", "responsibility": "What it does" }]
      },
      "integration_points_brief": {
        "variable": "integration_points_brief",
        "type": "text",
        "required": false,
        "hint": "...",
        "value": "FILLED VALUE HERE",
        "items": [],
        "rows": []
      }
    },
    "field-bug-root-cause-detail": {
      "root_cause_summary": {
        "variable": "root_cause_summary",
        "type": "text",
        "required": true,
        "hint": "Confirmed root cause statement",
        "value": "FILLED VALUE HERE",
        "items": [],
        "rows": []
      },
      "root_cause_category": {
        "variable": "root_cause_category",
        "type": "text",
        "required": true,
        "hint": "Code Defect, Configuration, Data Issue, Integration Failure, Design Gap",
        "value": "FILLED VALUE HERE",
        "items": [],
        "rows": []
      },
      "confidence_level": {
        "variable": "confidence_level",
        "type": "text",
        "required": true,
        "hint": "Confirmed, Probable, or Hypothesis",
        "value": "Confirmed",
        "items": [],
        "rows": []
      },
      "contributing_factors_items": {
        "variable": "contributing_factors_items",
        "type": "html",
        "required": true,
        "hint": "HTML li elements listing confirmed contributing factors",
        "value": "<li>Confirmed factor from PR evidence</li>",
        "items": [],
        "rows": []
      },
      "evidence_references": {
        "variable": "evidence_references",
        "type": "html",
        "required": false,
        "hint": "HTML with PR numbers, file changes, deployment evidence",
        "value": "<p>Confirmed via PR #123, deployment on YYYY-MM-DD.</p>",
        "items": [],
        "rows": []
      }
    },
    "field-release-notes": {
      "summary_text": {
        "variable": "summary_text",
        "type": "text",
        "required": true,
        "hint": "...",
        "value": "FILLED VALUE HERE",
        "items": [],
        "rows": []
      },
      "whats_new_items": {
        "variable": "whats_new_items",
        "type": "html",
        "required": true,
        "hint": "...",
        "value": "<li>Change 1</li>\n<li>Change 2</li>",
        "items": [],
        "rows": []
      },
      "impact_description": {
        "variable": "impact_description",
        "type": "text",
        "required": true,
        "hint": "...",
        "value": "FILLED VALUE HERE",
        "items": [],
        "rows": []
      },
      "known_limitations_items": {
        "variable": "known_limitations_items",
        "type": "html",
        "required": false,
        "hint": "...",
        "value": "<li>None — no known limitations</li>",
        "items": [],
        "rows": []
      },
      "related_items": {
        "variable": "related_items",
        "type": "html",
        "required": false,
        "hint": "...",
        "value": "<li>Related item</li>",
        "items": [],
        "rows": []
      }
    }
  },
  "extra_fields": {
    "story_points": 3,
    "tags": ["existing-tag-1", "existing-tag-2", "Dev-Complete"]
  },
  "release_notes_html": ""
}
```

### Step 11 [GATE/CLI] – Update ADO

**Final approval gate — present a summary of everything that will be pushed to ADO:**

J1 [GEN]: Show the user a concise summary:

- **Fields being updated**: list each ADO field name and a one-line description of what's changing
- **Tags**: current → new (with {{tags.dev_complete}} appended)
- **Story points**: planned → final
- **Scope changes**: count of added/removed/modified components
- Ask: _"Ready to push these updates to ADO work item #{{work_item_id}}? (yes/no)"_

J2 [LOGIC]: **WAIT** — do NOT run the update command until the user explicitly confirms.
J3 [LOGIC]: If user says no → ask what needs to change, go back to the relevant step, and re-present.

J4 [CLI]: Only after user confirms, **dry-run first** to verify rendering:
`{{cli.ado_update}} {{work_item_id}} --from-context "{{context_file}}" --phase closeout --dry-run --json`

J4.1 [LOGIC]: If dry-run shows errors (missing slots, unfilled tokens, rendering failures) → fix context file and re-run dry-run.
J4.2 [CLI]: When dry-run succeeds:
`{{cli.ado_update}} {{work_item_id}} --from-context "{{context_file}}" --phase closeout --json`

The CLI automatically:

1. Renders `field-solution-design` template from closeout.filled_slots → final HTML
2. Renders `field-bug-root-cause-detail` template (Bug/Defect only) → Root Cause Detail HTML
3. Validates: no unfilled tokens, sections present
4. Maps rendered HTML + grooming_final fields + release_notes_html → ADO field paths (including `{{field_paths.root_cause_detail}}` for Bug/Defect)
5. Reads extra_fields for non-template fields (tags as array → joined with "; ", story_points as number)
6. Pushes all fields to ADO in a single update

### Step 12 [GEN/IO] – Summary

E1 [GEN]: Generate narrative summary
E2 [IO]: Save → {{context_file}}.closeout.summary_generated_at
E3 [IO]: Update {{context_file}}.metadata.current_phase = "complete"

## Completion [GEN]

Tell user: **"Dev true-up complete. Work item updated with as-built reality."**
