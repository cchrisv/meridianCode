# Technical Requirement Templates - Digital Platforms Project

> **Meridian:** WIP / not wired — **not** a `template_files.*` key in `shared.json` (see `user-story-templates.md`). Use **`shared/standards/refinement-standards.md`** in prompts for technical User Stories.

Templates for **technical** User Stories — system-visible or internal change. Same narrative standard as functional stories, with technical precision in WHAT, WHY, and Done When.

> **Authoritative:** `shared/standards/refinement-standards.md`

## Overview

- **What** (`what_text`): System change — plain language first, then precision (components, APIs) as needed. Implementation detail still belongs in Development Summary / solution design, not in grooming slots, when it would leak HOW.
- **Why** (`why_text`): Quantified or concrete business/system justification; assumptions in prose.
- **Unknowns** (optional list): Technical questions; omit when none.
- **Done When** (`done_when_items`): Measurable outcomes, error behavior, performance thresholds, boundaries — plain assertions grouped with optional `group_label` rows in the template registry.

## HTML templates

- Description: `#file:core/templates/field-technical-description.html`
- Done When: `#file:core/templates/field-technical-acceptance-criteria.html`

### Key rules

- Do not use **"As a developer, I want..."** in WHY — justify in business/system terms.
- WHY must not be abstract alone — include numbers where possible.
- Done When lines are outcomes, not task titles ("bulkify trigger" → measurable result).

---

## Example 1: Trigger bulkification (performance)

Plain-text sketch of slot values (the tooling renders rich HTML from the same slots).

### What (`what_text`)

> Refactor the Contact trigger handler to process records in bulk so governor limits are not exceeded during Banner integration batches. Behavior visible to users and integrations must stay the same.

### Why (`why_text`)

> The daily Banner-to-Salesforce sync upserts contacts in batches of up to 2,000 records. Sequential handler logic causes about **15 governor limit failures per week**, each needing manual reprocessing (~**5 hours/week** of integration team time) and delaying advisor access to updated student data by an average of **4 hours** per incident. Bulkifying the handler removes that operational tax while preserving existing automation behavior.

### Unknowns (`unknowns`) — optional

- Confirm Nebula Logger batch correlation id expected by the operations runbook (owner: integration team).

### Done When (`done_when_items`)

Use **repeatable blocks**: each row is one `assertion`; set `group_label` when starting a new category, then leave `group_label` empty for additional lines under that category.

| group_label         | assertion                                                                                                                                                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _Expected behavior_ | For a batch of **200** Contacts in one transaction, all rows process successfully with **fewer than 80** SOQL statements, **fewer than 120** DML statements, and wall-clock **under 10 seconds** on the reference sandbox hardware. |
| _(none)_            | For a batch of **2,000** Banner upserts, processing completes **without** governor limit exceptions and Nebula Logger records batch metrics for the run.                                                                            |
| _(none)_            | Single-record UI creates still exercise the same business outcomes as before, with **no** user-visible regression in save time on the reference profile.                                                                            |
| _Error handling_    | When **5** of **200** rows fail validation in one transaction, **195** valid rows persist, **5** rows show field-level errors, and Nebula Logger writes **ERROR** with enough context to find the failed subset.                    |
| _Regression_        | When a Contact insert meets Contact_After_Save Flow entry criteria, the Flow still runs and field updates from the Flow appear on the saved record.                                                                                 |
| _Regression_        | When a Contact is created with an Affiliation value, ContactAssignment still runs and the record is assigned with **no** trigger-order conflicts versus the refactored handler.                                                     |

---

## Example 2: API field addition (developer-facing)

### What (`what_text`)

> Add `advisor_assignment_id` to the Student Registration API response so consumers can render the assigned advisor without a second round-trip.

### Why (`why_text`)

> The mobile client currently chains two calls to paint registration + advisor, adding ~**800 ms** median latency and **doubling** call volume against a daily limit. Returning the field in the primary response removes the extra call, improves responsiveness, and cuts estimated API volume by ~**40%** while staying additive for existing clients.

### Unknowns (`unknowns`)

- _(omit or leave empty if none)_

### Done When (`done_when_items`)

| group_label             | assertion                                                                                                                                                                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _Expected behavior_     | For a student with assignment id `a0Xx000001234`, the JSON body includes `advisor_assignment_id` with that exact value.                                                                                                                   |
| _Boundaries_            | For a student with no assignment, the body includes `advisor_assignment_id` with value **null** and HTTP **200** (no fault).                                                                                                              |
| _Performance_           | Over **100** sequential calls against **500** students with assignments, average latency is within **50 ms** of the pre-change baseline measured in the same org.                                                                         |
| _Error handling_        | If the referenced assignment row was deleted after the student was loaded, the API returns `advisor_assignment_id: null`, returns **200**, logs a **warning** with an orphaned-reference code, and does not throw an unhandled exception. |
| _Regression / contract_ | For a consumer pinned to the prior schema, all previous properties are present with the same names and types; `advisor_assignment_id` is **additive** only (no removed, renamed, or retyped fields).                                      |

---

## Anti-Patterns to Avoid

### In Description

| Anti-Pattern                          | Problem                                     | Fix                                                                                           |
| ------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------- |
| "As a developer, I want..."           | Developer is doing the work, not benefiting | Use **Why** (`why_text`) with beneficiary and impact                                          |
| "Follows best practices"              | Abstract claim, no quantified impact        | State specific numbers: failures/week, hours consumed                                         |
| "Improve code quality"                | Not measurable                              | "Zero governor limit failures for batches up to 2,000 records"                                |
| Tasks as What ("Bulkify the trigger") | Describes work, not the change              | Describe the system behavior and boundaries in plain language                                 |
| Missing dependencies                  | Silent coupling                             | State consumers, deployment constraints, and contracts in **Why** or **Done When** boundaries |

### In Done When

| Anti-Pattern                  | Problem                               | Fix                                                                              |
| ----------------------------- | ------------------------------------- | -------------------------------------------------------------------------------- |
| "The error is handled"        | Untestable                            | Specify retry, logging level, recovery path, HTTP shape                          |
| "When the code is deployed"   | Activity, not verifiable system state | State deploy preconditions as observable checks                                  |
| "It works correctly"          | Subjective                            | Thresholds: time, counts, codes, log levels                                      |
| Missing regression coverage   | Refactor risk                         | Lines for every known consumer / contract you must not break                     |
| Too few assertions            | Ambiguous “done”                      | Several falsifiable lines: happy path, edge, error, regression (when applicable) |
| Percentages without baselines | "50% improvement" from what?          | State baseline **and** target: "from 45s to under 10s"                           |
