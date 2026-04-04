# Salesforce Test Cases Playbook (Dev + QA/UAT)

> **Meridian:** Active — `core/config/shared.json` → `template_files.test_cases_playbook`; also `#file:` from `util-pr-analysis`.

This playbook defines the methodology for creating high-quality, unambiguous, and traceable test cases for Salesforce enhancements. It is referenced by Phase 03d (Test Cases) and drives the quality bar for all generated test artifacts.

---

## §1 Testing Strategy

Before writing individual test cases, define the testing strategy for the work item.

### Test Objectives

What the test suite proves — derived from acceptance criteria + solution components:

- **Functional correctness** — each AC works as designed under normal conditions
- **Data integrity** — CRUD operations produce correct field values, relationships, and record states
- **Performance** — solution operates within governor limits and meets responsiveness expectations
- **Security** — access controls, data isolation, and sharing rules enforce correctly

### Scope Definition

- **In-scope**: features, modules, and integrations directly touched by this work item
- **Out-of-scope**: existing functionality not modified; upstream/downstream systems not changed
- Derive from `solution_design.components` and `integration_points`

### Suite Organization

Classify each planned test into one or more buckets:

- **Smoke**: post-deployment sanity — "is the org healthy?"
- **Regression**: existing behavior not broken by changes
- **Feature**: new or modified functionality validation
- **UAT**: business stakeholder verification using real workflows

### Entry Points

Identify which channels each test targets:

- Lightning UI (standard Salesforce experience)
- Experience Cloud (community/portal users)
- Mobile (Salesforce Mobile App)
- API (REST/SOAP/Bulk/Streaming)
- Integration User (system-to-system, platform events, scheduled jobs)

---

## §2 Test Types

Not all types apply to every work item. Flag each as **Applicable** or **N/A** with justification.

| #   | Type                    | Owner    | When It Applies                                          | What to Generate                                                                   |
| --- | ----------------------- | -------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | **Unit testing**        | Dev      | Apex code changes (classes, triggers, actions)           | Apex unit test patterns with System.assert, Test.startTest/stopTest, mock callouts |
| 2   | **Smoke testing**       | QA       | Any change to core flows                                 | High-level checks: login, navigation, create/edit key records                      |
| 3   | **Integration testing** | QA       | System boundary changes (API, events, external callouts) | Data flow validation across boundaries, error handling, retry logic                |
| 4   | **System testing**      | QA       | End-to-end journeys affected                             | Full journey from entry to completion across Salesforce objects                    |
| 5   | **UAT**                 | Business | User-facing changes                                      | Business-language scripts with observable outcomes                                 |
| 6   | **Performance testing** | QA/Dev   | Bulk operations, governor limits, complex queries        | Bulk data scenarios (1, 2, 200 records), SOQL query performance                    |
| 7   | **Security testing**    | QA/Dev   | Permission/sharing changes, new objects/fields           | CRUD/FLS per persona, sharing rule enforcement, profile-based access               |

---

## §3 Test Data Matrix

### Purpose

Define reusable test data rows that test cases reference by ID (D1, D2, etc.). This ensures consistency and repeatability across test execution.

### Row Structure

Each row defines a complete test context:

| Column              | Description                                                                      |
| ------------------- | -------------------------------------------------------------------------------- |
| **Row ID**          | D1, D2, D3... with emoji prefix: 👤 persona, 📊 data variation, ⚠️ negative/edge |
| **Persona**         | Profile name, permission sets, role in hierarchy, license type                   |
| **Record context**  | Record type, key field values, parent/child relationships                        |
| **Feature flags**   | Custom settings, custom metadata types, feature toggles                          |
| **Boundary values** | Min/max, null/blank, long strings (255+ chars), special characters               |
| **External IDs**    | For integration/identity resolution scenarios                                    |
| **Error injection** | Downstream failures, timeouts, missing data (for resilience tests)               |

### Persona Detail

For each persona row (👤), document:

1. **Test user setup**: username, profile, permission sets, role
2. **Required test records**: object, record name, key field values, purpose
3. **Feature flag configuration**: flag name, value, reason

---

## §4 AC-Centric Coverage

Every test case traces to one or more acceptance criteria. The coverage model ensures no AC is left untested.

### Coverage Status

- ✅ **Full** — has at least one happy path AND one unhappy path test
- ⚠️ **Partial** — has only happy OR only unhappy path tests (requires written justification)
- ❌ **Gap** — no test coverage (blocker — must be addressed before saving)

### Minimum Requirements

- Every AC MUST have at least ONE happy path test (path A)
- Every AC MUST have at least ONE unhappy path test (path B, C, D, E, or F)
- P1 test cases should cover both happy and critical negatives for each AC

---

## §5 Six-Path Coverage Model

Generate test cases per AC using six coverage paths. Not every path applies to every AC — generate only where relevant.

### A) Happy Path

The simplest successful scenario. Validates the AC works as designed with valid inputs, correct permissions, and expected data.

**Generate when**: Always — every AC gets at least one happy path test.

### B) Negative Path

Validates error handling when things go wrong: validation rules fire, required fields missing, duplicate rules trigger, permissions denied.

**Generate when**: Always — every AC gets at least one negative test.

**Salesforce-specific scenarios**:

- Validation rule fires → user-friendly error message displayed
- Required field missing → save blocked with field-level error
- Duplicate rule → merge/block behavior as configured
- Insufficient permissions → access denied, no data leak

### C) Edge Cases

Boundary conditions and unusual-but-valid inputs.

**Generate when**: Data input, bulk operations, picklist dependencies, record types, dynamic forms.

**Salesforce-specific scenarios**:

- Null/blank values in optional fields
- Maximum field lengths (255 char text, 131072 char long text)
- Picklist values not in expected set (mismatched record types)
- Time zone edge cases (cross-day boundaries)
- Bulk operations: 1 record, 2 records, 200 records (trigger batch boundary)
- Mixed record types in same batch
- Dynamic forms — field visibility conditions

### D) Security

Access control and data isolation verification.

**Generate when**: New objects, new fields, sharing rule changes, profile/permission set modifications.

**Salesforce-specific scenarios**:

- CRUD per persona: can create? read? update? delete?
- FLS per persona: can see field? edit field?
- Sharing: record owner access, role hierarchy access, manual shares, sharing rules
- Data isolation: User A cannot see User B's records when sharing restricts
- Running user context in automation (flows, triggers, Apex)

### E) Automation Behavior

Validates that automated processes behave correctly, especially order-of-execution concerns.

**Generate when**: Triggers, flows, validation rules, process builders, platform events modified.

**Salesforce-specific scenarios**:

- Order of execution: validation rules → before triggers → after triggers → flows
- Recursion guards: trigger fires, updates record, trigger fires again — handled?
- Idempotency: same input twice produces same result (no double-creation)
- Mixed DML: setup objects (User, PermissionSet) + non-setup in same transaction
- Governor limits: SOQL queries, DML statements, CPU time under bulk

### F) Integration + Async

External system interactions and asynchronous processing.

**Generate when**: External callouts, platform events, queueable/batch/scheduled Apex, CDC.

**Salesforce-specific scenarios**:

- External system down → error logged, retry queued, user notified
- External system slow → timeout handled gracefully
- Platform event published → subscriber receives and processes
- Retry logic → failed events reprocessed successfully
- Eventual consistency → async process completes within expected window
- Error logging → integration errors captured in custom log object or Nebula Logger

---

## §6 UAT Scripts

UAT scripts are business-friendly test scripts for stakeholder validation. They differ from QA test cases:

| Aspect               | QA Test Case                       | UAT Script                                  |
| -------------------- | ---------------------------------- | ------------------------------------------- |
| **Audience**         | Technical testers                  | Business stakeholders                       |
| **Language**         | Technical (SOQL, API, field names) | Business (natural language, workflow terms) |
| **Scope**            | Specific paths and edge cases      | End-to-end business workflows               |
| **Expected results** | Exact field values, record states  | Observable business outcomes                |
| **Pass/fail**        | Precise assertions                 | Business acceptance decision                |

### UAT Script Structure

Each UAT script includes:

1. **Title** — business-language description of what's being validated
2. **Persona** — which business role executes this script
3. **Preconditions** — what must exist before starting (in business terms)
4. **Steps** — clear actions using business terminology, not technical jargon
5. **Expected results** — what the user should observe at each step
6. **Data requirements** — what records/users must exist
7. **Acceptance criteria** — explicit pass/fail decision for the script

---

## §7 Test Case Quality — Unambiguous & Provable

Every test case must be **unambiguous** (anyone can execute it) and **provable** (pass/fail is objective).

### Measurable Expected Results

❌ Bad: "Record is routed correctly"
✅ Good: "Record Owner = 'Enrollment Queue'; Priority = 'Medium'; Status = 'New'"

❌ Bad: "Error message displays"
✅ Good: "Toast message shows: 'You do not have permission to edit this record.' with severity 'error'"

❌ Bad: "Data syncs properly"
✅ Good: "Contact.External_ID**c = '12345'; Contact.Sync_Status**c = 'Synced'; Contact.Last_Sync\_\_c = TODAY"

### Deterministic Steps

- One action per step
- Numbered sequentially
- No branching ("if X, then Y" — split into separate test cases)
- Exact inputs specified (not "enter some data" — "enter 'John Smith' in First Name")

### Pass/Fail Criteria

Every test case explicitly states:

- What constitutes a **pass** (all expected results match)
- What constitutes a **fail** (any deviation from expected results)
- What to do on fail (log defect, capture screenshot, note actual vs. expected)

---

## §8 Smoke Test Pack

The smoke test pack is a minimum post-deployment verification checklist. It answers: "Is the org healthy after deployment?"

### Standard Smoke Checks

| #   | Check                     | What to Verify                                  | Pass Criteria                                  |
| --- | ------------------------- | ----------------------------------------------- | ---------------------------------------------- |
| 1   | **Login + navigation**    | Core app loads, affected tabs/pages accessible  | No errors, pages render, menus work            |
| 2   | **Create key record**     | Create/update records affected by the change    | Record saves, fields populate, no errors       |
| 3   | **Automation sanity**     | Routing, assignment, approval rules fire        | Expected automation triggers, correct outcomes |
| 4   | **Integration handshake** | External system queues, logging, event delivery | No errors in logs, events published/received   |
| 5   | **Report/dashboard**      | Representative report loads (if applicable)     | Data displays, no timeouts, correct counts     |

### Smoke Pack Principles

- **Shallow, not deep** — confirms basic health, not full coverage
- **Fast** — entire pack should complete in <15 minutes
- **Independent** — each check can run in any order
- **Repeatable** — same results on repeated execution

---

## §9 Test Data Repeatability

### Data Recipes

Every test data row should include a "recipe" — a repeatable setup procedure:

1. **User creation**: profile assignment, permission sets, role
2. **Record creation**: object, field values, relationships
3. **Configuration**: feature flags, custom settings, sharing rules
4. **Cleanup**: what to delete/reset after test execution

### Avoid

- "Create a contact" — which fields? what values?
- "Use an admin user" — which profile? which permission sets?
- "Enable the feature" — which setting? what value? where?

### Prefer

- "Create Contact: FirstName='Test', LastName='User_D1', Email='test.d1@sandbox.test', RecordType='Student'"
- "User: Profile='Admissions User', PermSets=['Email_Composer_User'], Role='Admissions_Advisor'"
- "CustomSetting Feature_Flags**c: Enable_New_UI**c = true"

---

## §10 Developer & QA Validation

### Developer Validation (per test case)

Each test case includes guidance for the developer writing unit tests:

1. **Unit test pattern** — Apex test method skeleton with Arrange/Act/Assert
2. **Assertions to implement** — specific `System.assertEquals` / `System.assertNotEquals` calls
3. **Mocks required** — `HttpCalloutMock`, `Test.setMock`, custom mocks for external services
4. **Integration points to verify** — trigger execution (check debug log), flow execution, platform event publication

### QA Validation (per test case)

Each test case includes guidance for the QA tester:

1. **Step-by-step navigation** — App Launcher → Tab → Action
2. **Data verification query** — SOQL to confirm record state post-test
3. **Visual verification checkpoints** — specific UI elements to check
4. **Environment prerequisites** — user login, feature flags, permission sets

---

## §11 Quality Traps to Avoid

These are common test case quality failures. Phase 03d quality gates check for all of them.

| #   | Trap                        | Symptom                                                      | Fix                                                            |
| --- | --------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------- |
| 1   | **Admin-only testing**      | All tests run as System Administrator                        | Add persona-specific test cases for each relevant profile      |
| 2   | **Vague expected results**  | "Works correctly", "Displays properly", "Saves successfully" | Rewrite with exact field values, record states, UI text        |
| 3   | **Implicit test data**      | "Create a record", "Use a test user"                         | Specify exact field values, profile, permission sets           |
| 4   | **Missing negative tests**  | Only happy paths tested                                      | Add validation rule, permission denial, missing data scenarios |
| 5   | **Mega-tests**              | Single test covers 5+ ACs                                    | Split into focused tests covering ≤3 ACs each                  |
| 6   | **Untraceable tests**       | Test doesn't map to any AC                                   | Add AC mapping or remove test if not needed                    |
| 7   | **Non-deterministic steps** | "If X, do Y; otherwise do Z"                                 | Split into separate test cases for each branch                 |
| 8   | **Missing cleanup**         | Test leaves orphaned data                                    | Add post-conditions/cleanup steps                              |
| 9   | **Copy-paste tests**        | Identical steps with minor variations                        | Use data matrix rows to parameterize                           |
| 10  | **No telemetry**            | No way to verify backend behavior                            | Add debug log patterns, event monitoring, custom log checks    |
