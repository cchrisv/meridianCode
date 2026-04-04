# Util – Refinement Review

> **Meridian:** Active — GitHub Copilot custom prompt (/.github/prompts/).

Role: Refinement Auditor — Standards Compliance
Mission: Deep refinement review for an already-groomed ticket, comparing Description + **Done When** (Acceptance Criteria) against `shared/standards/refinement-standards.md` (functional vs technical + grooming rules), and writing structured findings back into the unified ticket context (read-only for ADO fields).
Config: `#file:core/config/shared.json` · `#file:shared/standards/share-core.md` · `#file:core/knowledge/share-ado.md` · `#file:core/knowledge/share-ado-research.md` · `#file:shared/standards/refinement-standards.md`
Input: `{{work_item_id}}`

## Constraints

- **Read-only for ADO** – do NOT call `{{cli.ado_update}}` or modify any ADO fields or tags; this utility only reads ADO and writes into `{{context_file}}`.
- **Unified context only** – use `{{root}}/ticket-context.json` as the single source of truth; no extra artifact files.
- **CLI-only** – use only `{{cli.*}}` commands; never raw shell (`curl`, `az`, `git`, `npm`).
- **No comments** – never post comments to work items.
- **Standards-driven** – apply the rules from `shared/standards/refinement-standards.md`.
- **Solution-neutral** – identify where requirements violate solution-neutrality, but do not propose or write new solution design into ADO fields.
- **Idempotent** – multiple runs update/replace a single `grooming.refinement_review` block instead of creating duplicates.

## Outputs

All findings are written ONLY to `{{context_file}}`:

- `grooming.refinement_review` — primary results object for the refinement review.
- `run_state.completed_steps[]` — append a marker entry that the refinement review was executed.

## Tone & Messaging Guidance

This review is an **educational tool**, not a judgment. Frame all feedback to:

**✓ DO:**

- Explain WHY a standard exists and what risk it mitigates
- Show concrete examples of what good looks like
- Frame issues as learning opportunities: "Consider adding..." not "You forgot..."
- Acknowledge partial progress: "The AC has good coverage on X; adding Y would strengthen..."
- Use collaborative language: "Let's clarify..." not "This is wrong"
- Link patterns to real-world consequences: "Without UPDATE scenarios, the validation might fire unexpectedly when users edit existing records, similar to defect #264712"
- Provide actionable next steps with specific examples

**✗ DON'T:**

- Use absolute judgment language: "incorrect", "wrong", "bad", "fails"
- Imply incompetence: "You should know...", "Obviously...", "This is basic..."
- Use condescending phrases: "simply", "just", "clearly", "of course"
- State problems without context or examples
- Criticize without offering constructive alternatives
- Assume malicious intent or carelessness

**Message Structure:**

1. **Observation** — What the current state is (neutral, factual)
2. **Context** — Why the standard exists or what risk it addresses
3. **Example** — Show what good looks like or reference a real scenario
4. **Action** — Specific, actionable next step

**Example (Bad):** "Vague acceptance line. This is wrong. You need to be more specific."

**Example (Good):** "The Done When line 'validation is handled' doesn't specify what 'handled' means in observable terms. QA needs the exact error message, field highlighting, or system behavior. Consider: 'When Duty Station is blank on save, the user sees error message \"Duty Station is required\" and the Duty Station field is highlighted in red.' This specificity prevents ambiguity during testing."

`grooming.refinement_review` structure:

```json
{
  "run_metadata": {
    "work_item_id": "",
    "executed_at": "",
    "requirement_type": "functional|technical|unknown",
    "stored_work_class": "",
    "phases_available": ["research", "grooming", "solutioning", "finalization"]
  },
  "classification": {
    "stored_type": "",
    "inferred_type": "",
    "confidence": "high|medium|low",
    "notes": ""
  },
  "checklist_results": [
    {
      "id": "",
      "category": "description|ac|type|tags|evidence|ocm",
      "severity": "info|warning|error",
      "status": "pass|fail|not_evaluated",
      "message": "",
      "evidence": ""
    }
  ],
  "assertion_inventory": {
    "total": 0,
    "by_category": {
      "happy_path": 0,
      "edge_case": 0,
      "error_handling": 0,
      "regression": 0
    },
    "group_labels_seen": []
  },
  "evidence_audit": {
    "citations_present": { "status": "pass|fail|not_evaluated", "notes": "" },
    "core_assertions_supported": { "status": "pass|fail|not_evaluated", "notes": "" },
    "unsupported_precision": [""],
    "notes": ""
  },
  "assertion_audits": [
    {
      "assertion_id": "DW-01",
      "assertion_text": "",
      "group_label": "",
      "category": "happy_path|edge_case|error_handling|regression|uncategorized",
      "issues": [
        {
          "issue_type": "vague_language|implementation_leak|not_measurable|scope|other",
          "severity": "info|warning|error",
          "message": "",
          "excerpt": "",
          "recommendation": ""
        }
      ],
      "quality_score": "pass|warning|fail",
      "functional_compliance": {
        "applies": true,
        "stakeholder_observable": { "status": "pass|fail|not_applicable", "notes": "" },
        "no_implementation_leaks": { "status": "pass|fail|not_applicable", "notes": "" }
      },
      "technical_compliance": {
        "applies": true,
        "measurable_outcome": { "status": "pass|fail|not_applicable", "notes": "" },
        "has_thresholds_when_performance_claim": {
          "status": "pass|fail|not_applicable",
          "notes": ""
        }
      },
      "testability": {
        "is_testable": true,
        "notes": ""
      }
    }
  ],
  "ocm_analysis": {
    "is_required": false,
    "rationale": "",
    "trigger_components": [],
    "dimension_coverage": {
      "dml_context": {
        "insert": "Covered|Out of Scope|Missing",
        "update": "Covered|Out of Scope|Missing",
        "upsert": "Covered|Out of Scope|Missing",
        "delete_undelete": "Covered|Out of Scope|Missing"
      },
      "user_context": {
        "target_users": "Covered|Out of Scope|Missing",
        "non_target_users": "Covered|Out of Scope|Missing",
        "sys_admin": "Covered|Out of Scope|Missing",
        "integration_api": "Covered|Out of Scope|Missing"
      },
      "data_context": {
        "new_record": "Covered|Out of Scope|Missing",
        "existing_populated": "Covered|Out of Scope|Missing",
        "existing_blank_required": "Covered|Out of Scope|Missing",
        "integration_created": "Covered|Out of Scope|Missing",
        "converted": "Covered|Out of Scope|Missing"
      },
      "action_context": {
        "manual_save": "Covered|Out of Scope|Missing",
        "email_send": "Covered|Out of Scope|Missing",
        "task_completion": "Covered|Out of Scope|Missing",
        "flow_automation": "Covered|Out of Scope|Missing",
        "lead_conversion": "Covered|Out of Scope|Missing"
      },
      "source_context": {
        "manual_ui": "Covered|Out of Scope|Missing",
        "integration_api": "Covered|Out of Scope|Missing",
        "bulk_import": "Covered|Out of Scope|Missing",
        "marketing_cloud": "Covered|Out of Scope|Missing"
      }
    },
    "missing_dimensions": [],
    "out_of_scope_rationales": {},
    "compliance_status": "pass|fail|not_applicable",
    "notes": ""
  },
  "invest_results": {
    "applies": true,
    "independent": { "status": "pass|fail|not_applicable", "notes": "" },
    "negotiable": { "status": "pass|fail|not_applicable", "notes": "" },
    "valuable": { "status": "pass|fail|not_applicable", "notes": "" },
    "estimable": { "status": "pass|fail|not_applicable", "notes": "" },
    "small": { "status": "pass|fail|not_applicable", "notes": "" },
    "testable": { "status": "pass|fail|not_applicable", "notes": "" }
  },
  "technical_quality": {
    "applies": true,
    "business_justification": { "status": "pass|fail|not_applicable", "notes": "" },
    "goals_thresholds": { "status": "pass|fail|not_applicable", "notes": "" },
    "constraints_dependencies": { "status": "pass|fail|not_applicable", "notes": "" }
  },
  "anti_patterns": [
    {
      "rule_id": "",
      "category": "global|functional|technical|ac|mixed",
      "severity": "info|warning|error",
      "message": "",
      "excerpt": ""
    }
  ],
  "summary": {
    "quality_rating": "Unacceptable|Needs Improvement|Meets Expectations|Exceeds Expectations",
    "rating_rationale": "",
    "ready_for_development": true,
    "top_recommendations": [""],
    "improvement_plan": {
      "assertions_to_add": [
        {
          "category": "happy-path|edge-case|error-handling|regression|ocm-dimension",
          "suggested_summary": "",
          "rationale": "",
          "example_assertion": "One plain-English Done When line a QA engineer could verify without guessing."
        }
      ],
      "clarifying_questions_for_business": [
        {
          "question": "",
          "context": "",
          "why_it_matters": "",
          "related_ac": ""
        }
      ],
      "description_improvements": [
        {
          "section": "",
          "current_state": "",
          "recommended_change": "",
          "example": ""
        }
      ]
    },
    "architect_readiness": {
      "has_enough_information": true,
      "confidence": "high|medium|low",
      "notes": ""
    },
    "qa_readiness": {
      "has_enough_information": true,
      "confidence": "high|medium|low",
      "notes": ""
    }
  }
}
```

---

## Prerequisites [IO/CLI]

1. [IO] Load `#file:core/config/shared.json` → extract `paths.*`, `cli_commands.*` (as `{{cli.*}}`), `field_paths.*`, `tags.*`.
2. [CLI] `{{cli.workflow_status}} -w {{work_item_id}} --json`

- If context exists → continue.
- If it fails → run `{{cli.workflow_prepare}} -w {{work_item_id}} --json`, then re-load status.

3. [IO] Load `{{context_file}}` and verify `metadata.work_item_id` matches `{{work_item_id}}`.

- Do **not** require any particular phase (`research`, `grooming`, etc.) to be completed; this util must run independently.

4. [CLI] Retrieve the latest ADO work item, including the business fields and comments needed for review:

- `{{cli.ado_get}} {{work_item_id}} --expand All --comments --json`
- Use `field_paths.*` to extract:
  - `{{field_paths.description}}` → Description text.
  - `{{field_paths.acceptance_criteria}}` → AC text.
  - `{{field_paths.business_problem_and_value}}`, `{{field_paths.business_objectives_and_impact}}` (if present).
  - `{{field_paths.work_class_type}}` or equivalent classification field (if present).
  - Tags and Work Item Type.
- **EXCLUDE from analysis**: `{{field_paths.development_summary}}` (Custom.DevelopmentSummary) — this is a solutioning output field written by Phase 04, not a grooming input. Do NOT evaluate, analyze, or reference this field in any refinement review findings.

5. [IO] Optionally, read any existing `grooming.refinement_review` block from `{{context_file}}` so this run can overwrite or extend prior results, but **do not** depend on grooming/research content.

---

## Step 1 [GEN] – Requirement Type Classification

1.1 [GEN]: Determine stored type from ADO fields:

- Prefer `grooming.classification.requirement_type` from `{{context_file}}` when present. If grooming did not persist a type, fall back to `System.WorkItemType`, tags, and any classification field exposed via `field_paths.work_class_type` (if configured) to infer whether the ticket is intended to be `functional`, `technical`, or `unknown`.

  1.2 [GEN]: Independently infer requirement type using `shared/standards/refinement-standards.md` §1:

- If a non-technical person would notice the change when done → `functional`.
- If only system internals, APIs, or developers are affected → `technical`.
- If unclear, reason from Description + **Done When** assertions:
  - User- or stakeholder-observable outcomes → `functional`.
  - System-measurable outcomes, metrics, contracts → `technical`.

  1.3 [GEN]: Populate `grooming.refinement_review.classification`:

- `stored_type` from `grooming.classification.requirement_type` when available; otherwise use the best stored signal from ADO tags/classification fields.
- `inferred_type` from standards.
- `confidence` = `high|medium|low` based on how strongly the standards point one way.
- `notes` explaining key signals (e.g., “Done When lines reference UI messages and pages”).

  1.4 [GEN]: Add checklist entries:

- `RR-CLASS-01` – "Requirement type classification present in grooming".
- `RR-CLASS-02` – "Requirement type aligns with standards decision framework".
- Mark `status` = `fail` on `RR-CLASS-02` if stored vs inferred types differ and add an anti_pattern with `rule_id = "mixed_type_or_misclassified"`.

---

## Step 2 [GEN] – Extract Description & AC Artifacts

2.1 [GEN]: Extract raw text for Description & AC directly from ADO using the payload from Step 4:

- Description source: `{{field_paths.description}}` field value.
- Acceptance Criteria source: `{{field_paths.acceptance_criteria}}` field value.
- Business value/objectives: `{{field_paths.business_problem_and_value}}` and `{{field_paths.business_objectives_and_impact}}` when available.

  2.2 [GEN]: Build a canonical internal representation for review (from ADO text only):

- **Meridian (preferred):** Parse Description into **What**, **Why**, and optional **Unknowns** (match gradient headers / section titles in HTML). Parse Acceptance Criteria into an ordered list of **Done When** assertions; capture optional **group labels** (_Expected behavior_, _Error handling_, _Boundaries_, etc.) when present.
- **Legacy (if detected):** If the Description still uses the old five-section functional layout or four-section technical layout, map those sections; if AC is still **Gherkin**, parse scenarios for backward compatibility only — do **not** require Gherkin for pass/fail on Meridian tickets.

  2.3 [GEN]: Record checklist entries for template completeness:

- **Meridian:** `RR-DESC-M01` substantive **What**; `RR-DESC-M02` substantive **Why**; `RR-DESC-M03` **Unknowns** (if present) are real questions; `RR-AC-M01` at least **three** substantive **Done When** lines unless documented not-applicable rationale exists. Missing any required Meridian element → `severity = "error"`.
- **Legacy:** If legacy sections detected without Meridian headers/slots, use the former `RR-DESC-01+` / `RR-DESC-10+` rules as informational/warning only — prefer Meridian checks when both appear.

  2.4 [GEN]: Build a first-class evidence audit:

- Extract explicit citations, anchors, quotes, linked research references, or other traceable evidence markers from Description, AC, business value fields, and any relevant `grooming` or `research` content already present in `{{context_file}}`.
- Populate `evidence_audit.citations_present` based on whether the ticket contains enough traceable support for its most specific claims.
- Populate `evidence_audit.core_assertions_supported` based on whether thresholds, exact messages, risk statements, and scope boundaries are supported rather than inferred.
- Add checklist items:
  - `RR-EVIDENCE-01` — "Evidence citations present for key requirement claims"
  - `RR-EVIDENCE-02` — "Exact thresholds/messages are supported by evidence when present"
- If the ticket uses exact thresholds, messages, or risk language without support, add an anti_pattern with `rule_id = "unsupported_precision"`.

---

## Step 3 [GEN] – Done When Quality & Coverage (Type-Agnostic)

3.1 [GEN]: Parse **Done When** content:

- Treat each plain-English assertion as one auditable unit (`DW-01`, `DW-02`, …).
- Preserve optional **group_label** text when extracted from HTML or bullets.

  3.2 [GEN]: **Coverage by intent** — classify each assertion into `happy_path`, `edge_case`, `error_handling`, `regression`, or `uncategorized` using keywords, group labels, and semantics (not Gherkin tags). When automation-heavy work warrants it, verify all four primary intents are represented or explicitly scoped; add checklist items `RR-AC-10`–`RR-AC-13` for material gaps.

  3.3 [GEN]: **Assertion clarity** — flag vague phrases in any assertion: "works correctly", "is handled", "functions properly", "performs well", "as expected", "gracefully", "appropriate". Each hit → `anti_patterns[]` with `category = "ac"`, educational `message`, and a `recommendation` showing a concrete rewritten **Done When** line.

  3.4 [GEN]: Update `grooming.refinement_review.assertion_inventory` with totals and `by_category` counts; record distinct `group_labels_seen` when useful.

  3.5 [GEN]: **Per-assertion audit** — for each **Done When** line, append `assertion_audits[]`:

- `assertion_id`, `assertion_text`, `group_label`, inferred `category`.
- `functional_compliance` (when type is functional): stakeholder-observable outcome; no implementation leaks.
- `technical_compliance` (when type is technical): measurable or explicitly bounded system outcome; thresholds present when claiming performance/latency/throughput/error rates.
- `issues[]` with `issue_type`, `severity`, `excerpt`, `message`, `recommendation`.
- `quality_score` = `pass|warning|fail`; `testability.notes` — can QA execute without guessing?

  3.5.1 [GEN]: Cross-check evidence against assertion precision:

- When an assertion cites exact UI copy, strict thresholds, retries, or compatibility guarantees, ensure `evidence_audit` supports it; otherwise flag `RR-EVIDENCE-02` and add an assertion-level issue.

  3.6 [GEN]: **Operational Context Matrix (OCM) Analysis** — Per `#file:shared/standards/operational-context-matrix.md`, determine if OCM analysis is required. OCM is MANDATORY if the work item involves: validation rules, before/after triggers, record-triggered flows, process builders, assignment rules, or required field changes (FLS/layout).

- If OCM is required, evaluate **Done When** coverage (plain-English assertions) against all five dimensions.
  - **Dimension 1 (DML Context)**: INSERT, UPDATE, UPSERT, DELETE/UNDELETE — assertions or explicit Out of Scope.
  - **Dimension 2 (User Context)**: Target users (positive), non-target users (negative), sys admin, integration/API users.
  - **Dimension 3 (Data Context)**: New records, existing with data, existing with BLANK required fields, integration-created, converted records.
  - **Dimension 4 (Action Context)**: Manual save, email send, task completion, flow/automation, lead conversion.
  - **Dimension 5 (Source Context)**: Manual UI, integration API, bulk import, Marketing Cloud.
- For each dimension item, mark as `Covered` (assertion exists), `Out of Scope` (explicit rationale in Description, Done When, or comments), or `Missing` (gap).
- Populate `ocm_analysis.dimension_coverage` and `ocm_analysis.missing_dimensions[]`.
- Set `ocm_analysis.compliance_status` to `pass` (all covered or scoped), `fail` (missing dimensions), or `not_applicable` (OCM not required).
- If OCM fails, add anti_patterns with `rule_id = "ocm_dimension_missing"` for each gap.

---

## Step 4 [GEN] – Functional-Specific Checks (If Type = Functional)

4.1 [GEN]: Description format (**Meridian Modern Work Item Standard** preferred):

- Confirm **`what_text`** and **`why_text`** are present and substantive **OR** (legacy) all former 5 sections exist and are non-empty.
- Detect placeholders: `[TBD]`, `[TO BE DETERMINED]`, `[PLACEHOLDER]` → treat as `severity = "error"`.

  4.2 [GEN]: WHY quality:

- WHY must answer business/user impact; assumptions may appear as prose in WHY.
- Legacy only: if `As a / I want / so that` blocks remain, enforce persona quality (real role, not "a user") and business outcome.

  4.3 [GEN]: Value & boundaries:

- Modern: measurable intent and boundaries may appear in WHY and **Done When**; flag weak WHY missing stakeholder motivation.
- Legacy: require ≥2 Goals; explicit Out of Scope.

  4.4 [GEN]: Unknowns:

- If **Unknowns** section/slot exists, items must be real questions — not placeholders.

  4.5 [GEN]: Solution-neutrality:

- Scan Description + **Done When** for banned implementation terms: `LWC`, `Apex`, `Flow`, `trigger`, `SOQL`, `Platform Event`, Lightning component, Visualforce, object API names, etc.
- For each hit, add a functional anti_pattern (e.g., `rule_id = "solution_leak_functional"`) with the offending snippet.

  4.6 [GEN]: Done When (functional):

- Each line must describe user- or stakeholder-observable outcomes where the work is user-facing.
- Ban vague phrases (`works correctly`, `as expected`, `handled gracefully`).
- If legacy GWT remains in the field, apply user-context / user-action / user-outcome checks to Then-equivalent content.

  4.7 [GEN]: INVEST:

- Evaluate each INVEST dimension for this requirement; update `invest_results` and add checklist items.

---

## Step 5 [GEN] – Technical-Specific Checks (If Type = Technical)

5.1 [GEN]: Description format (**Meridian** preferred):

- Confirm **`what_text`** and **`why_text`** substantive **OR** (legacy) all 4 former sections exist and are non-empty.
- Flag any placeholders as `severity = "error"`.

  5.2 [GEN]: WHY / justification:

- WHY must include quantified or concrete business/system justification (incident counts, latency, error rates, records affected, compliance risk).
- If justification is only abstract ("improves quality") without data, add `rule_id = "abstract_business_justification"`.

  5.3 [GEN]: Measurable outcomes:

- Modern: measurable thresholds live in **Done When** assertions; require multiple concrete system outcomes or boundaries.
- Legacy: ≥2 Goals rows with explicit thresholds; outcomes not tasks.

  5.4 [GEN]: Dependencies / constraints:

- Modern: may be folded into WHY or Done When boundary lines — do not treat as missing if clearly stated there.
- Legacy: Constraints & Dependencies section.

  5.5 [GEN]: Done When (technical):

- Assertions must be system-measurable or explicit boundary statements.
- If legacy GWT remains, apply system-state / system-event / measurable Then checks.

  5.6 [GEN]: Domain emphasis (optional):

- Reflect performance, integration, security, regression expectations in **Done When** lines when relevant.

---

## Step 6 [GEN] – Anti-Patterns, Scoring, and Summary

6.1 [GEN]: Aggregate all checklist_results and anti_patterns into a total count for reference.

6.2 [GEN]: Determine summary.quality_rating using this rubric:

**Unacceptable** — Blocking issues that prevent development:

- Missing required sections (no Done When / AC content, no substantive Description)
- Type misclassification (functional vs technical)
- Insufficient **Done When** coverage: fewer than 3 substantive assertions when modern format applies, without documented not-applicable rationale; OR (legacy) fewer than 4 scenarios without rationale OR missing 2+ outcome categories
- OCM required but 3+ dimensions completely missing (no assertions, no Out of Scope)
- Placeholders ([TBD], [TO BE DETERMINED]) in required fields
- Assertions untestable (all vague: "works correctly", "as expected")

**Needs Improvement** — Has foundation but needs refinement before dev-ready:

- Missing material outcome categories in **Done When** (edges, errors, boundaries)
- OCM required with 1-2 dimensions missing
- Several vague assertions
- Architect OR QA readiness = No with ≥3 missing details
- Functional requirements with ≥2 implementation leaks (Apex, Flow, LWC in Description/Done When)
- Technical requirements missing measurable thresholds in most assertions
- Legacy: generic persona ("a user") or business outcome missing

**Meets Expectations** — Dev-ready with minor opportunities for improvement:

- **Done When** covers happy path, material risks, and boundaries appropriately
- OCM either not required OR all dimensions covered/scoped
- ≤2 minor clarity issues
- Architect AND QA readiness = Yes OR No with ≤2 minor gaps
- Follows functional vs technical standards (no major violations)
- Testable, traceable, clear scope

**Exceeds Expectations** — Exemplary refinement quality:

- Six or more precise **Done When** lines (or fewer if evidence-bound and fully scoped) with rich coverage when evidence supports that depth
- OCM dimensions covered with both positive AND negative assertions where automation demands it
- Every **Done When** line is specific, measurable, with exact UI elements/thresholds/messages supported by evidence when claimed
- Explicit scope boundaries appear in **Why** or **Done When** (or pointers to related work items)
- Strong evidence citations from research or grooming context support the most specific claims
- Architect AND QA readiness = Yes with high confidence
- The ticket could serve as a model: clear What/Why, honest Unknowns, and concrete assertions without guesswork

  6.3 [GEN]: Determine `summary.ready_for_development`:

- `false` if `quality_rating = "Unacceptable"`.
- `false` if `quality_rating = "Needs Improvement"` AND (architect_readiness = No OR qa_readiness = No).
- Otherwise `true`.

  6.3.1 [GEN]: Populate `summary.rating_rationale` with 2-3 sentences explaining why this rating was assigned, citing specific strengths or gaps.

  6.4 [GEN]: Populate `summary.top_recommendations` with 3–5 high-level, concise actions (applies to all ratings).

  6.4.1 [GEN]: **If quality_rating is "Unacceptable" OR "Needs Improvement"**, populate `summary.improvement_plan` with detailed, actionable guidance:

**assertions_to_add[]** — For each missing or inadequate **Done When** line:

- `category` — happy-path, edge-case, error-handling, regression, or specific OCM dimension
- `suggested_summary` — short label for the gap
- `rationale` — why this assertion matters for risk or test coverage
- `example_assertion` — one plain-English line QA could verify (specific messages, counts, HTTP codes, timings as appropriate)
  - Reference existing assertions in the ticket for tone/consistency
  - For OCM-related gaps, cite the dimension (reference defect #264712 when instructive)

**clarifying_questions_for_business[]** — For each ambiguity or assumption that needs validation:

- `question` — specific question to ask the business (not "what do you mean?", but "Does the validation fire on UPDATE context or INSERT only?")
- `context` — background: what AC or requirement triggered this question
- `why_it_matters` — the development or testing risk if this remains unclear
- `related_ac` — which AC ID(s) this question would clarify

**description_improvements[]** — For description violations (placeholders, vague user story, missing sections):

- `section` — which Description section needs work (Summary, User Story, Goals, etc.)
- `current_state` — what's there now (or "Missing")
- `recommended_change` — specific guidance on what to add/fix
- `example` — show what good looks like with a concrete example

**Guidance for improvement_plan population:**

- Prioritize items by impact on development and testing quality
- Limit to top 8-10 actionable items (don't overwhelm)
- Every item must be specific and actionable (not "improve clarity")
- Reference the ticket's own context (existing **Done When** lines, field names, object)

  6.4.1 [GEN]: Architect & QA readiness reflection:

- **Architect readiness** – Answer: If you were a solution architect designing this change, do you have enough information in this ticket (Description + AC + related context) to design a high-quality solution without inventing requirements? Set `summary.architect_readiness.has_enough_information` to `true` or `false`, set `summary.architect_readiness.confidence` to `high|medium|low`, and capture any gaps in `summary.architect_readiness.notes`.
- **QA readiness** – Answer: If you were a QA engineer creating a regression-safe test plan, do you have enough information in this ticket (Description + AC + tags) to design a high-quality test plan that both prevents regressions and validates the requested new behavior? Set `summary.qa_readiness.has_enough_information` to `true` or `false`, set `summary.qa_readiness.confidence` to `high|medium|low`, and capture any gaps in `summary.qa_readiness.notes`.

  6.5 [IO]: Write `grooming.refinement_review` into `{{context_file}}` and update `metadata.last_updated`.

  6.6 [IO]: Append a run_state entry such as:

```json
"run_state": {
  "completed_steps": [
    "refinement_review:{{work_item_id}}"
  ]
}
```

(If other steps already exist, append instead of replacing.)

---

## Completion [GEN]

**CRITICAL**: After writing JSON artifacts to {{context_file}}, you MUST generate a human-readable markdown report for the user. DO NOT present JSON output to the user.

### Report Requirements

1. **Character Limit**: Keep report under 7000 characters total
2. **Brevity**: Be concise and direct. Avoid repetitive language and verbose explanations
3. **Focus**: Prioritize actionable findings over exhaustive detail
4. **Consolidate**: Group similar issues together rather than repeating patterns
5. Populate the template below with actual data, removing unused sections entirely

### Report Template

Use this structure and populate it with real data:

---

# Refinement Review Report

**Work Item**: [ID] - [Title] | **Type**: [Type] | **Rating**: [Rating]

## Executive Summary

**Strengths**: [2-3 bullet points, 1 line each]

**Rating Rationale**: [1-2 sentences max citing specific evidence]

**Status**: [Ready for dev | Needs refinement | Blocking gaps]

## Description Analysis

[Only list sections with issues. If all sections pass, state "✓ All sections complete and well-formed."]

**Issues Found**:

1. [Section Name]: [Specific issue in 1 sentence] → [Recommendation in 1 sentence]
2. [Section Name]: [Issue] → [Recommendation]
   [Max 5 items]

## Acceptance Criteria Analysis

**Done When assertions**: [count] total ([H] happy, [E] edge, [R] error, [G] regression)

**Coverage Gaps**: [If all four intents present where applicable: "✓ Coverage looks balanced."] [Otherwise: List missing categories and automation-context gaps in 1-2 lines (DML contexts, profiles, data conditions, actions, sources) without jargon dumping.]

## Assertion issues

[ONLY list assertions with issues. If all pass, state "✓ All Done When lines pass validation."]

**DW-[N]: [first words…]** ([score]/10)

- [Issue 1 in 1 sentence] → [Fix in 1 sentence]
- [Issue 2] → [Fix]
  [Max 3 issues per assertion]

[Repeat only for assertions with issues, max 5 total]

## Readiness

**Architect**: [Yes/No] ([Confidence]) [If No: 1-2 sentence gap summary]
**QA**: [Yes/No] ([Confidence]) [If No: 1-2 sentence gap summary]

## Improvement Plan

[ONLY if rating is Unacceptable/Needs Improvement]

**Assertions to add** ([count]):

1. [Category]: [Summary] - [1-line rationale]
2. [Category]: [Summary] - [1-line rationale]
   [Max 5 recommendations]

**Questions for Business** ([count]):

1. [Question]? - [Why it matters in 1 line]
   [Max 5 questions]

**Description Fixes** ([count]):

1. [Section]: [Issue] → [Fix]
   [Max 3 items]

## Action Items

[Consolidate all fixes from above sections into a single numbered list. Be specific but concise. List all items in order of appearance from report sections above.]

1. [Action] - [Brief why] - [From which section]
2. [Action] - [Brief why] - [From which section]
3. [Action] - [Brief why] - [From which section]
   [Continue for all items, max 15 total]

---

## Development Readiness Decision

**[GO / NO-GO]**

[Decision logic - must match summary.ready_for_development field from Step 6.3:

- **NO-GO** if quality_rating = "Unacceptable"
- **NO-GO** if quality_rating = "Needs Improvement" AND (Architect readiness = No OR QA readiness = No)
- **GO** otherwise (i.e., "Meets Expectations" or "Exceeds Expectations", OR "Needs Improvement" with both Architect AND QA readiness = Yes)]

**Rationale**: [1-2 sentences explaining the decision based on quality rating, architect readiness, QA readiness, and any blocking issues]

**Next Step**: [If GO: "Ticket approved for Phase 03 (Solutioning Research) or direct development"] [If NO-GO: "Complete all action items above, address readiness gaps, then re-run refinement review"]

---

_End of Refinement Review Report_
