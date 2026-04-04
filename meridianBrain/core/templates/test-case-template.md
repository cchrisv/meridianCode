# Test Case Template

> **Meridian:** Active — `core/config/shared.json` → `template_files.test_case`. Playbook companion: `template_files.test_cases_playbook` → `test-cases-playbook.md`.

This template provides a structured approach to creating comprehensive test cases for Salesforce enhancements. Use this template to ensure all test cases include oracles, limits, logs, and proper traceability.

## AC Coverage Matrix by Path Type

Before creating individual test cases, create an AC-centric coverage matrix that ensures every Acceptance Criteria has both happy path AND unhappy path test coverage.

| AC ID | Description      | Happy Path Tests | Negative Tests | Edge Case Tests | Security Tests | Coverage Status |
| ----- | ---------------- | ---------------- | -------------- | --------------- | -------------- | --------------- |
| AC-1  | [AC description] | TC-001           | TC-005         | TC-008          | —              | ✅ Full         |
| AC-2  | [AC description] | TC-002           | TC-006         | —               | TC-010         | ✅ Full         |
| AC-3  | [AC description] | TC-003           | —              | —               | —              | ⚠️ Partial      |

**Coverage Status Legend:**

- ✅ **Full** = Has at least one Happy Path test AND one Unhappy Path test (Negative, Edge, or Security)
- ⚠️ **Partial** = Has only Happy Path OR only Unhappy Path tests (requires justification)
- ❌ **Gap** = No test coverage (blocker - must be addressed)

**Path Type Definitions:**

- **Happy Path (✓):** Validates AC works as expected under normal conditions with valid inputs
- **Negative (✗):** Validates error handling, invalid inputs, permission failures, missing data
- **Edge Case (⚡):** Validates boundary conditions, bulk operations, timing, concurrent access
- **Security (🔒):** Validates access controls, data isolation, FLS/CRUD enforcement, sharing rules

**Minimum Coverage Requirements:**

- Every AC MUST have at least ONE Happy Path test
- Every AC MUST have at least ONE Unhappy Path test (Negative, Edge, or Security)
- P1 test cases should cover both happy path and critical negatives for each AC

## Test Case Structure

### Standard Format

Each test case follows this structure:

---

#### Test Case Header

|                        |                                                                        |
| ---------------------- | ---------------------------------------------------------------------- |
| **Test Case ID**       | `TC-XXX` (sequential numbering)                                        |
| **Title**              | Short, descriptive title (e.g., "Happy path - Record Type assignment") |
| **Path Type**          | ✓ Happy Path / ✗ Negative / ⚡ Edge Case / 🔒 Security                 |
| **Covers AC**          | AC-1, AC-2 (which acceptance criteria this test validates)             |
| **Priority**           | 🔴 P1 / 🟡 P2 / 🟢 P3                                                  |
| **Data Row**           | D1 (reference to test data matrix)                                     |
| **Estimated Duration** | X minutes                                                              |

#### Objective / Oracle

- What observable outcome proves success?
- What data changes, UI state, outbound calls, or logs demonstrate the enhancement works?
- Be specific: exact field values, record counts, events emitted, HTTP stubs called with payload X

#### Pre-conditions & Setup Checklist

- [ ] User is logged in as specified persona (reference test data matrix row)
- [ ] Required test records exist with specified attributes
- [ ] Feature flags / settings are enabled as specified
- [ ] Environment configuration is correct
- [ ] Mocks or test doubles are in place (if applicable)
- [ ] Integration endpoints are available/mocked (if applicable)

#### Step-by-Step Execution

| Step | Action                             | Input/Data                     | Expected Result                      |  ✓  |
| :--: | ---------------------------------- | ------------------------------ | ------------------------------------ | :-: |
|  1   | [Navigate to specific page/record] | [URL or navigation path]       | [Page loads, correct data displayed] |  ☐  |
|  2   | [Perform specific UI action]       | [Exact values to enter/select] | [Immediate visual feedback]          |  ☐  |
|  3   | [Verify intermediate state]        | [What to check]                | [Expected intermediate result]       |  ☐  |
|  4   | [Complete the primary action]      | [Final input or button click]  | [Success indicator/confirmation]     |  ☐  |
|  5   | [Verify final outcome]             | [Where to verify]              | [Expected final state]               |  ☐  |

> **Note:** Each step should be atomic and independently verifiable. If a step fails, the tester should know exactly where the failure occurred.

#### Verification Checklist

**UI Verification:**

- [ ] [Specific UI element shows expected state]
- [ ] [Toast/message displayed correctly]
- [ ] [Navigation occurred as expected]

**Data Verification:**

- [ ] [Record field X = expected value]
- [ ] [Record count matches expectation]
- [ ] [Formula fields calculated correctly]

**Related Records:**

- [ ] [Child/related records created/updated as expected]
- [ ] [Junction objects created if applicable]

**Notifications:**

- [ ] [Email sent to correct recipient with correct content]
- [ ] [Platform Event published with correct payload]

#### Telemetry & Logs to Verify

| Log Type       | What to Look For                            | Where to Find It               |
| -------------- | ------------------------------------------- | ------------------------------ |
| Debug Log      | [Specific log message pattern]              | Developer Console > Debug Logs |
| Platform Event | [Event name: `Event_Name__e`]               | Event Monitoring / Subscriber  |
| Custom Log     | [Nebula Logger entry with specific message] | Log\_\_c records query         |
| Flow Debug     | [Flow Interview ID, element execution]      | Debug Logs with FLOW category  |

#### Cleanup Steps

- [ ] Delete test record(s) created during test
- [ ] Reset any changed settings/feature flags
- [ ] Clear any cached data if applicable
- [ ] Restore original state for rerunnable tests

#### Traceability

| Traceability Type       | Reference  |
| ----------------------- | ---------- |
| **Acceptance Criteria** | AC-1, AC-2 |
| **Solution Component**  | COMP-001   |
| **Requirement ID**      | REQ-001    |
| **Work Item**           | #12345     |

#### Developer Validation

This section provides developers with specific guidance for implementing automated tests.

| Aspect                | Details                                               |
| --------------------- | ----------------------------------------------------- |
| **Unit Test Pattern** | `@IsTest static void test_[scenario]() { ... }`       |
| **Test Method Name**  | `test_[Object]_[Action]_[Condition]_[ExpectedResult]` |

**Assertions to Implement:**

```apex
// Primary assertion - validates the main outcome
System.assertEquals([expected_value], [actual_value], '[descriptive message]');

// Secondary assertions - validates related data
System.assertNotEquals(null, [record].Id, 'Record should be created');
System.assertEquals([expected_count], [query_results].size(), 'Expected N records');
```

**Mocks Required:**

- [ ] [External service mock - describe what to mock and return value]
- [ ] [HTTP callout mock - endpoint and response]
- [ ] [Platform Event test subscriber - if applicable]

**Integration Points to Verify:**

- [ ] [API endpoint called with correct payload]
- [ ] [Trigger fired in correct order]
- [ ] [Flow executed with correct variables]

#### QA Validation

This section provides QA testers with specific guidance for manual testing.

**Step-by-Step Navigation:**

1. App Launcher → [App Name]
2. [Object] tab → [List View or New button]
3. [Specific page/component] → [Action to perform]

**Data Verification Query:**

```sql
SELECT Id, [Field1], [Field2], [Field3]
FROM [Object__c]
WHERE [Condition]
-- Expected: [describe expected results]
```

**Visual Verification Checkpoints:**

- [ ] [UI element 1] displays [expected state]
- [ ] [Toast/message] shows [expected text]
- [ ] [Component/section] is [visible/hidden/enabled/disabled]
- [ ] [Field value] matches [expected value]

**Environment Prerequisites:**

- [ ] Logged in as: [Username or persona from test data matrix]
- [ ] Feature flag `[Flag_Name__c]` = [ON/OFF]
- [ ] Permission set `[Permission_Set_Name]` assigned
- [ ] Test data from row [DX] exists

---

### Priority Definitions

- **🔴 P1** = High business impact or high change-surface (happy path, critical negatives)
- **🟡 P2** = Typical alternates and key negatives
- **🟢 P3** = Long-tail, cosmetic, or already covered elsewhere

### Gherkin Format (For Automation)

For test cases that will be automated, use Gherkin syntax:

```gherkin
Scenario: <short title>
  Given <state/setup>
  And <persona/permissions>
  When <action/input>
  Then <observable result A>
  And <observable result B>
```

**Example:**

```gherkin
Scenario: Happy path - Record Type assignment
  Given Record Type "Zoom Webinar Lead" exists and is deploy-activated
  And Flow "INVOKE | Populate Lead Required Fields" is active
  And Feature flag "Zoom Webinar Flow" is ON
  And I am logged in as Marketing User with Lead:Create permission
  When I insert a Lead via integration with Lead Source "Webinar – Zoom"
  Then Lead is created with RecordType.DeveloperName = "Zoom_Webinar_Lead"
  And All required fields are populated as per mapping
  And Flow log Debug__c contains Invocation ID
  And No unhandled faults occur
```

## Test Data Matrix Structure

Create a reusable test data matrix that can be referenced across multiple test cases:

**Row ID:** `D1`, `D2`, `D3`, etc.

**Columns:**

- **Persona:** Role name and permission set
- **Record Type:** Record type or picklist combo
- **Boundary Values:** Min/max, empty vs required, length limits, date windows
- **Feature Flags:** Settings that must be configured
- **External IDs:** Test external IDs and duplicates (for identity resolution)
- **Error Injection:** Downstream 4xx/5xx, timeouts, failure scenarios

**Example Test Data Matrix:**

| Row | Persona                            | Lead Source      | Existing Record Type | Host Fallback User | Feature Flag |
| --- | ---------------------------------- | ---------------- | -------------------- | ------------------ | ------------ |
| D1  | Marketing User (perm: Lead:Create) | "Webinar – Zoom" | (n/a new)            | present            | ON           |
| D2  | Marketing User (no Lead:Create)    | "Webinar – Zoom" | (n/a new)            | present            | ON           |
| D3  | Marketing User                     | "Webinar – Zoom" | (n/a new)            | missing            | ON           |
| D4  | Integration User                   | "Webinar – Zoom" | (n/a new)            | present            | ON           |

## Scenario Derivation Lenses

Systematically derive test scenarios by working through these lenses:

1. **Happy Path** - Primary success scenario
2. **Alternates** - Valid variations (different roles, record types, locales)
3. **Boundaries** - Min/max, empty vs required, length, date windows
4. **Negatives** - Violations (missing perms, invalid input, failures from dependencies)
5. **State Transitions** - Create→update→archive, retries/idempotency
6. **Concurrency & Bulk** - 1, typical, max; parallel jobs
7. **Security** - Profile/perm set, FLS, sharing; multi-tenant data isolation
8. **Resilience** - Downstream timeouts, retries, circuit breakers; graceful fault paths
9. **Non-Functional** - Performance, accessibility, telemetry, audit, i18n
10. **Regression** - What nearby behavior must not change

## Test Case Example (Standard Format)

**Test Case ID:** TC-001

**Title:** Happy path (Record Type assignment)

**Objective/Oracle:** New Leads from Zoom get Record Type = Zoom Webinar Lead; debug log contains Flow Invocation ID.

**Pre-reqs/Setup:**

- Record Type exists and is deploy-activated
- Flow active
- Feature flag "Zoom Webinar Flow" = ON

**Priority:** P1

**Persona/Permissions:** D1 (Marketing User with Lead:Create permission)

**Input/Test Data:** D1

**Steps:**

1. Insert Lead via integration (simulate Zoom payload) with minimal required fields.

**Expected Results:**

- Lead is created with RecordType.DeveloperName = Zoom_Webinar_Lead
- All required fields populated as per mapping
- Flow log Debug\_\_c contains Invocation ID and "assigned Zoom Webinar Lead"
- No unhandled faults; Flow's Fault path not triggered

**Telemetry/Logs to Verify:**

- Event: Flow_Invocation
- Debug ID: Flow Invocation ID
- Log line: "assigned Zoom Webinar Lead"

**Edge/Cleanup:**

- Delete test Lead record
- Reset feature flag if changed

**Traceability:**

- Acceptance Criteria: AC-1
- Solution Component: COMP-001
- Requirement ID: REQ-001

## Test Case Example (Negative - Permissions)

**Test Case ID:** TC-002

**Title:** Permissions negative

**Objective/Oracle:** Flow fails gracefully when user lacks create permission.

**Pre-reqs/Setup:**

- Record Type exists
- Flow active
- Feature flag "Zoom Webinar Flow" = ON
- User without Lead Create permission configured

**Priority:** P1

**Persona/Permissions:** D2 (Marketing User without Lead:Create permission)

**Input/Test Data:** D2

**Steps:**

1. Attempt creation via user without Lead Create permission

**Expected Results:**

- No Lead created
- Fault path executes and writes structured debug entry with error code & userId
- Platform Event/Log accessible to ops with correlation ID

**Telemetry/Logs to Verify:**

- Event: Flow_Fault
- Debug ID: Correlation ID
- Log line: Error code and userId in structured format

**Edge/Cleanup:**

- Verify no orphaned records created
- Reset user permissions if changed

**Traceability:**

- Acceptance Criteria: AC-2
- Solution Component: COMP-001
- Requirement ID: REQ-001

## Test Case Example (Bulk Safety)

**Test Case ID:** TC-004

**Title:** Bulk safety (limit/serialization)

**Objective/Oracle:** Flow handles bulk inserts without limit errors.

**Pre-reqs/Setup:**

- Record Type exists
- Flow active
- Feature flag "Zoom Webinar Flow" = ON
- Test data for 200 Leads prepared

**Priority:** P1

**Persona/Permissions:** D4 (Integration User)

**Input/Test Data:** D4 (bulk: 200 records)

**Steps:**

1. Insert 200 Leads in a single transaction

**Expected Results:**

- All 200 succeed
- CPU, SOQL, and DML under limits
- No "Too many SOQL/DML" or serialization faults
- One Flow interview per record or batched per design
- Aggregate debug summary present

**Telemetry/Logs to Verify:**

- Event: Flow_Bulk_Processing
- Debug ID: Aggregate summary ID
- Log line: "Processed 200 records successfully"
- Governor limit usage logged

**Edge/Cleanup:**

- Delete all 200 test Lead records
- Verify no partial processing occurred

**Traceability:**

- Acceptance Criteria: AC-3
- Solution Component: COMP-001
- Requirement ID: REQ-001

## Quality Checklist

Before finalizing test cases, verify:

**AC Coverage Requirements:**

- [ ] AC Coverage Matrix is complete with all acceptance criteria listed
- [ ] Every AC has at least ONE happy path test
- [ ] Every AC has at least ONE unhappy path test (negative, edge, or security)
- [ ] Any coverage gaps are documented with justification

**Test Case Quality:**

- [ ] P1 test cases cover happy path and critical negatives
- [ ] Test data matrix is reusable across cases
- [ ] Test cases include oracles (exact field values, record counts, events)
- [ ] Platform limits are tested (governor limits, queue sizes, payload sizes)
- [ ] Observability is asserted (log lines, Platform Events, Debug IDs)
- [ ] Test cases are prioritized with risk (P1/P2/P3)
- [ ] Test cases link to acceptance criteria and solution components
- [ ] Gherkin format provided for automation-ready cases
- [ ] Edge cases and cleanup steps documented
- [ ] Telemetry and logging verification included

**Developer/QA Validation:**

- [ ] Every test case includes Developer Validation section with unit test pattern and assertions
- [ ] Every test case includes QA Validation section with navigation and verification steps
- [ ] Data verification queries are provided for QA to validate outcomes
- [ ] Environment prerequisites are clearly documented

## Pro Tips

1. **Make data reusable:** Seed fixtures once; reference by ID in cases
2. **Name logs & events deterministically:** Use consistent naming (e.g., `ZoomLead_Assignment_v58`) and assert on them
3. **Test idempotency:** Reprocess same payload—no duplicates; ensure external ID or de-dupe guard
4. **Test toggles:** Feature flag OFF = legacy path still works
5. **Include access patterns:** Profiles + FLS + sharing for every happy path
6. **Automate priorities first:** P1 as Apex tests/Jest or Flow test suites; leave long-tail to manual/UAT
7. **Attach evidence:** Screenshot, SOQL query result, or log snippet to each executed case
8. **Keep traceability:** Link each case to a requirement/acceptance criterion

## Acceptance Criteria Checklist

Drop this into your story to ensure test coverage:

- [ ] Record Type assignment enforced for Zoom-created Leads
- [ ] Fault path produces structured telemetry with correlation IDs
- [ ] Owner resolution: host → fallback with clear logs
- [ ] Bulk: 1/10/200 records pass within governor limits
- [ ] Security: operations succeed/fail correctly by permission & FLS
- [ ] No regression to non-Zoom Lead creation paths
