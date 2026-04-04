# Operational Context Matrix (OCM) — Acceptance Criteria Standard for Salesforce Work

> **Meridian:** Active — Copilot `#file:shared/standards/operational-context-matrix.md` (e.g. refinement review OCM step; grooming OCM gates).

## What Is the Operational Context Matrix?

The Operational Context Matrix (OCM) is a **mandatory supplement** for any Salesforce work item that touches validation rules, triggers, flows, process builders, or any automation that fires on record save. It ensures requirements cover five operational dimensions — not just the happy-path primary use case.

Work items groomed under **Meridian Modern Work Item Standard** express OCM coverage as **plain-English Done When lines** (and boundaries) in `Microsoft.VSTS.Common.AcceptanceCriteria`, not as Given/When/Then scenario cards in ADO.

The OCM requires that for each dimension, the story either has **explicit coverage in Done When** (or WHY/Done When boundary statements) **OR an explicit Out of Scope declaration with rationale**. Silence equals a gap, not an exclusion.

---

## The Five Dimensions

### Dimension 1: DML Context — What save operations does this fire on?

**This is the #1 source of production defects from narrow AC.**

Salesforce validation rules, triggers, and flows fire on different DML operations. A rule intended for INSERT may also fire on UPDATE unless explicitly constrained. Every groomed requirement must answer (in **Done When**):

| DML Context                                 | Should Rule Fire? | Coverage required?                                                                                                                    |
| ------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **INSERT** (new record creation)            | Yes / No / N/A    | Baseline: at least one **assertion** (or boundary) for applicable contexts. Exceeds: positive **and** negative where materially risky |
| **UPDATE** (editing existing record)        | Yes / No / N/A    | Same — express as Done When lines                                                                                                     |
| **UPSERT** (integration creates or updates) | Yes / No / N/A    | Same                                                                                                                                  |
| **DELETE / UNDELETE**                       | Yes / No / N/A    | Assertion or explicit Out of Scope                                                                                                    |

**Example: Negative DML Context Scenario (what was missing from #203664)**

**Given** an existing Lead with Campus = ASIA and Duty Station blank (created via integration before this rule existed),  
**When** a Europe Division user sends an email on that Lead (triggering UPDATE),  
**Then** the email sends successfully — the validation does NOT fire on UPDATE context because this rule is intended for INSERT only.

### Dimension 2: User Context — Who triggers this?

Different user profiles, permission sets, and departments interact with the same objects differently. **Done When** must cover:

| User Context                     | Example                                              |
| -------------------------------- | ---------------------------------------------------- |
| Target department/division users | Europe Division, Asia Division staff                 |
| Non-target department users      | Stateside, Adelphi staff (should NOT be affected)    |
| System Administrator profile     | Sys admins performing data maintenance               |
| Integration/API users            | MuleSoft integration user, Marketing Cloud connector |

**Rule:** For each user context, write at least one **Done When** assertion confirming whether the behavior fires or does not fire. Negative assertions ("validation does NOT fire for Stateside users") are just as important as positive ones.

**Exceeds calibration:** For exemplary coverage, pair positive and negative **assertions** across applicable user contexts so the ticket clarifies both who is affected and who is explicitly not affected.

### Dimension 3: Data Context — What state is the record in?

Records exist in different states depending on when and how they were created. **Done When** must address:

| Data State                          | Why It Matters                                                                                                                                                         |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Newly created (no prior data)       | Primary happy path — rule fires as designed                                                                                                                            |
| Existing with all fields populated  | Rule should allow saves — no missing data                                                                                                                              |
| Existing with required fields blank | **The 264712 case.** Records created before the rule existed may have blank fields. Updates to these records will trigger validation on fields the user isn't editing. |
| Imported/migrated records           | Bulk-imported data often has different completeness than manual entry                                                                                                  |
| Converted records (Lead → Contact)  | Conversion triggers DML and may fire validation unexpectedly                                                                                                           |

### Dimension 4: Action Context — What triggers the save?

Many user actions trigger implicit record saves that invoke validation rules and triggers. **Done When** must address the full range of save-triggering actions:

| Action                          | Triggers Record Save?                                        | Invokes Validation?                |
| ------------------------------- | ------------------------------------------------------------ | ---------------------------------- |
| Manual Save button click        | Yes — explicit DML                                           | Yes                                |
| Email send (from record)        | Yes — updates LastActivityDate, triggers related record save | Yes                                |
| Task completion                 | Yes — updates related record via automation                  | Yes (if automation updates parent) |
| Quick Action / Global Action    | Yes — explicit DML                                           | Yes                                |
| Flow/Process Builder automation | Yes — system DML                                             | Yes (unless bypassed)              |
| Assignment rule execution       | Yes — updates Owner field                                    | Yes                                |
| Approval process step           | Yes — updates status fields                                  | Yes                                |
| Lead conversion                 | Yes — DML on Lead and Contact                                | Yes                                |

**The #264712 Lesson**

Asia/Europe staff needed to **send emails** and **complete tasks** on Leads to collect missing Duty Station data. Both of these actions trigger implicit record saves that invoked the Duty Station validation. Coverage only tested "manual Save button click" — never email sends or task completions.

### Dimension 5: Source Context — Where does the record originate?

Records enter Salesforce through multiple channels, each with different data completeness expectations:

| Source                      | Data Completeness                    | UMGC Examples                       |
| --------------------------- | ------------------------------------ | ----------------------------------- |
| Manual UI (Lightning)       | High — user fills all visible fields | Staff manually creating a Lead      |
| Integration API (MuleSoft)  | Variable — depends on source system  | eApp, Web forms, Zoom Webinar       |
| Data Loader / Bulk Import   | Variable — depends on CSV quality    | Batch data migrations, list imports |
| Marketing Cloud Sync        | Partial — marketing fields only      | Journey Pipeline updates            |
| Web-to-Lead / Email-to-Lead | Low — minimal required fields        | Website inquiry forms               |

**Rule:** If a record can enter the system through a channel, **Done When** must address how the rule behaves for records from that channel — both at creation and on subsequent edits.

**Baseline vs Exceeds:** Baseline OCM coverage requires each applicable dimension item to have at least one explicit **Done When** assertion or an Out of Scope rationale. Exceeds-quality OCM coverage adds both positive and negative assertions wherever the dimension item is in scope and materially risky.

### Exceeds Calibration Rules

- Treat baseline and Exceeds as different coverage levels, not wording variants.
- Baseline: each applicable dimension item has at least one explicit assertion or an Out of Scope rationale.
- Exceeds: each applicable, materially risky dimension item has both a positive and a negative assertion unless it is explicitly out of scope with rationale.
- Do not manufacture scenarios just to satisfy symmetry. If a dimension item is genuinely not in scope, state that directly and explain why.
- For automation-heavy work, Exceeds-quality OCM coverage should make it obvious who is affected, who is not affected, where the rule fires, and where it explicitly does not fire.

---

## When OCM Is Required

OCM analysis is MANDATORY when the work item involves any of the following Salesforce component types:

| Component Type                      | Why OCM Required                                                             |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| Validation Rules                    | Fire on every DML context unless formula explicitly constrains them          |
| Before/After Triggers               | Execute on specified DML events; side effects may cascade                    |
| Record-Triggered Flows              | Fire on record create/update/delete based on configuration                   |
| Process Builders (legacy)           | Fire on record changes; may invoke validation indirectly                     |
| Assignment Rules                    | Trigger record updates that invoke the full save cycle                       |
| Required Field Changes (FLS/Layout) | Making fields required affects all save contexts, not just the intended form |

**OCM is NOT required** for work items that only involve: page layout changes (no field requirements), report/dashboard creation, permission set READ access changes, or documentation updates.

---

## OCM Checklist Template

Copy this checklist into the work item comments during refinement. Every box must be checked or explicitly marked N/A with rationale before the work item can exit refinement.

```
## Operational Context Matrix Checklist

### Dimension 1: DML Context
- [ ] INSERT scenario(s) written — rule fires / does not fire
- [ ] UPDATE scenario(s) written — rule fires / does not fire
- [ ] UPSERT scenario(s) written OR marked Out of Scope with rationale
- [ ] DELETE/UNDELETE addressed OR marked Out of Scope with rationale

### Dimension 2: User Context
- [ ] Target user profile/department scenario(s) written (positive)
- [ ] Non-target user profile/department scenario(s) written (negative — rule does NOT fire)
- [ ] System Administrator scenario addressed
- [ ] Integration/API user scenario addressed

### Dimension 3: Data Context
- [ ] New record (no prior data) scenario written
- [ ] Existing record with fields populated scenario written
- [ ] Existing record with required fields BLANK scenario written (pre-existing data)
- [ ] Integration-created record scenario addressed
- [ ] Converted record scenario addressed OR marked Out of Scope

### Dimension 4: Action Context
- [ ] Manual Save button scenario written
- [ ] Email send scenario addressed (triggers implicit save)
- [ ] Task completion scenario addressed (triggers implicit save)
- [ ] Flow/automation-triggered save addressed
- [ ] Lead conversion scenario addressed OR marked Out of Scope

### Dimension 5: Source Context
- [ ] Manual UI-created records scenario written
- [ ] Integration-created records (eApp, Web, Zoom) scenario written
- [ ] Bulk import records scenario addressed OR marked Out of Scope
- [ ] Marketing Cloud sync records addressed OR marked Out of Scope

### Sign-off
- [ ] QA Testing Lead has reviewed OCM coverage
- [ ] Architect has confirmed DML context constraints in formula/code
- [ ] All Out of Scope items have documented rationale
```

---

## Anti-Patterns to Watch For

| Anti-Pattern                                                    | Why It's Dangerous                                                                        | What to Do Instead                                                      |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **All Given clauses say "is creating a new..."**                | Validation rules fire on ALL save contexts by default — not just creation                 | Add scenarios for UPDATE, UPSERT, and implicit saves                    |
| **No negative scenarios**                                       | You've defined when the rule fires, but not when it must NOT fire                         | Write "Then validation does NOT fire" scenarios for excluded contexts   |
| **Out of Scope by omission**                                    | #203664 said "focuses on manual UI creation only" but never said "UPDATE is out of scope" | Explicitly list every excluded dimension with rationale                 |
| **Only testing the "Save" button**                              | Email sends, task completions, and automations also trigger saves                         | List all actions that trigger saves on the affected object              |
| **Assuming integration records have same data as manual entry** | API-created records often have blank fields that manual forms enforce                     | Write scenarios for each record source with realistic data completeness |

---

## How OCM Integrates with Existing Quality Gates

OCM operates as **Gate 5: Operational Context** in the existing Quality Gates framework. It runs after Gate 2 (Testability) and before Gate 3 (Traceability):

- **Gate 0:** Solution Leak — requirements stay solution-neutral
- **Gate 1:** Clarity — everyone can understand requirements
- **Gate 2:** Testability — ACs are measurable (**Done When** / plain-English assertions)
- **Gate 5:** Operational Context (NEW) — ACs cover all five OCM dimensions
- **Gate 3:** Traceability — requirements connect to business goals
- **Gate 4:** Safety — risks identified and mitigated

**Gate 5 Tags:**

- `OCM-Enhanced` — Auto-fix added missing dimension scenarios (non-blocking)
- `OCM-Fail` — Could not generate scenarios for one or more dimensions; human review needed (blocking)
- `OCM-Not-Required` — Work item does not touch save-triggering components (informational)

---

## Reference: Defect #264712 Walkthrough

If OCM had been applied to Story #203664, here are the scenarios that would have caught the defect:

**DML Context — UPDATE Scenario**

**Given** an existing Lead with Campus = ASIA, Duty Station blank, created via MuleSoft,  
**When** Europe Division user edits the Lead (UPDATE context),  
**Then** the validation does NOT fire — this rule is intended for INSERT only.

**Action Context — Email Send Scenario**

**Given** a Lead missing Duty Station,  
**When** Asia Division user sends an email from the Lead record,  
**Then** the email sends successfully without validation error.

**Source Context — Integration Records Scenario**

**Given** 111 Leads created via eApp integration in the last 30 days with Campus = ASIA and Duty Station blank,  
**When** staff perform any action requiring Lead save,  
**Then** actions complete without validation error — integration-sourced Leads legitimately lack Duty Station at creation.

**Any one of these scenarios** would have surfaced the circular dependency before code was written, preventing 217 blocked Leads and a production rollback.

---

_Silence equals a gap, not an exclusion. Every OCM dimension must have **Done When** coverage or an explicit Out of Scope declaration._

📅 **Last Updated:** March 11, 2026 | 📌 **Origin:** Defect #264712 Post-Mortem | 🔗 **Related:** #265004 Refinement Standards
