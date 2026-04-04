# Bug/Defect Templates - Digital Platforms Project

> **Meridian:** Active — `core/config/shared.json` → `template_files.bug`. Defect narrative rules: **`shared/standards/defect-standards.md`** (grooming `#file:`).

Complete templates for Bug/Defect work items in Azure DevOps. Use these templates when applying business requirements during the AI Refinement phase.

## Overview

Bug reports should clearly explain:

- **WHAT** is broken (actual vs expected behavior, business impact)
- **WHY** it matters (affected workflows, users impacted)
- **HOW** to verify (step-by-step reproduction, testable outcomes)

This templates guide focuses on clarity and testability to help the development team understand context and make informed decisions during fix implementation.

## Description Field Template

### Structure (Summary Only)

Bug descriptions contain only a Summary section focusing on actual vs expected behavior and business impact. We keep this focused and non-technical so stakeholders understand the business impact without getting lost in technical root causes.

### Full Template (HTML)

**CRITICAL:** Use the rich HTML template for this field. See `#file:core/templates/field-bug-description.html` for the complete styled template.

The template includes:

- Bug summary with actual vs expected behavior
- Business impact callout
- Affected functionality section

```html
<!-- See field-bug-description.html for the complete styled template -->
<h2>📋 Summary</h2>
<p>
  [Actual vs expected behavior, affected functionality/area, and business impact. Avoid technical
  cause speculation. Focus on WHAT is broken, not HOW to fix it.]
</p>
```

### Example 1: Null Pointer Exception

```html
<h2>📋 Summary</h2>
<p>
  When creating a Contact record without an Affiliation, the system throws a null pointer exception
  and prevents the record from being saved. This blocks advisors from creating new student contacts
  and impacts enrollment workflows. Affected functionality: Contact creation process.
</p>
```

### Example 2: Data Sync Failure

```html
<h2>📋 Summary</h2>
<p>
  Contact email addresses are not syncing from Banner to Salesforce. Expected: Email updates from
  Banner appear in Salesforce within 5 minutes. Actual: Email changes remain stale for 24+ hours.
  Business impact: Advisors contact students at outdated email addresses, reducing communication
  effectiveness.
</p>
```

## Repro Steps Template

### Structure

Repro Steps include: Environment, Preconditions, Step-by-step instructions, Expected vs Actual results. Clear reproduction steps help the entire team (QA, developers, stakeholders) independently verify and validate the fix.

### Full Template (HTML)

**CRITICAL:** Use the rich HTML template for this field. See `#file:core/templates/field-bug-repro-steps.html` for the complete styled template.

The template includes:

- Environment and preconditions cards
- Numbered steps with visual styling
- Expected vs actual comparison with color-coded callouts

```html
<!-- See field-bug-repro-steps.html for the complete styled template -->
<h2>🔄 Repro Steps</h2>
<p><strong>Environment:</strong> [Org name, user profile, browser/device]</p>
<p><strong>Preconditions:</strong> [Required setup, data, permissions]</p>
<ol>
  <li>[Step 1 - specific action]</li>
  <li>[Step 2 - specific action]</li>
  <li>[Step 3 - specific action]</li>
  <li>[Continue as needed]</li>
</ol>
<p>
  <strong>Expected:</strong> [What should happen based on research or business rules]<br />
  <strong>Actual:</strong> [What actually happens - error message, wrong behavior, etc.]
</p>
```

### Example 1: Null Pointer Exception

```html
<h2>🔄 Repro Steps</h2>
<p><strong>Environment:</strong> Production org (production), Advisor profile, Chrome browser</p>
<p>
  <strong>Preconditions:</strong> User has Create permission on Contact object, no existing Contact
  record
</p>
<ol>
  <li>Navigate to Contacts tab</li>
  <li>Click "New" button</li>
  <li>
    Fill in required fields: First Name = "John", Last Name = "Doe", Email = "john.doe@example.com"
  </li>
  <li>Leave Affiliation field empty (do not select an affiliation)</li>
  <li>Click "Save" button</li>
</ol>
<p>
  <strong>Expected:</strong> Contact record saves successfully and user sees confirmation message
  "Contact John Doe was created."<br />
  <strong>Actual:</strong> Error toast appears: "An error occurred while saving the record. Review
  the error and try again." System logs show: "Attempt to de-reference a null object:
  ContactTriggerHandler line 45"
</p>
```

### Example 2: Data Sync Failure

```html
<h2>🔄 Repro Steps</h2>
<p>
  <strong>Environment:</strong> Production org, System Administrator profile, API call via Postman
</p>
<p>
  <strong>Preconditions:</strong> Banner sync job is scheduled and running, Contact record exists in
  both Banner and Salesforce
</p>
<ol>
  <li>Update Contact email in Banner from "old.email@example.com" to "new.email@example.com"</li>
  <li>Wait 5 minutes for sync job to run</li>
  <li>Query Contact record in Salesforce: SELECT Email FROM Contact WHERE Id = '003XX000004XYZ'</li>
  <li>Check sync job logs in Salesforce Setup → Scheduled Jobs</li>
</ol>
<p>
  <strong>Expected:</strong> Contact Email field in Salesforce updates to "new.email@example.com"
  within 5 minutes of Banner update.<br />
  <strong>Actual:</strong> Contact Email field remains "old.email@example.com" after 24 hours. Sync
  job logs show "No changes detected" even though Banner data changed.
</p>
```

## System Info Template

### Structure

System Info includes: Screenshots/Videos, Error Messages, Logs, Test Data. This section provides evidence that helps developers understand the scope and impact of the bug.

### Full Template (HTML)

**CRITICAL:** Use the rich HTML template for this field. See `#file:core/templates/field-bug-system-info.html` for the complete styled template.

The template includes:

- Screenshots/videos card
- Error messages card with red accent
- Logs section with code formatting
- Test data table

```html
<!-- See field-bug-system-info.html for the complete styled template -->
<h2>📊 Test Data and Supporting Information</h2>
<p><strong>Screenshots/Videos:</strong> [Links or descriptions if available]</p>
<p><strong>Error Messages:</strong> [Exact error message text from UI or logs]</p>
<p><strong>Logs:</strong> [Relevant log entries, stack traces, or debug output]</p>
<p><strong>Test Data:</strong> [Record IDs, sample data, or test scenarios used]</p>
```

### Example 1: Null Pointer Exception

```html
<h2>📊 Test Data and Supporting Information</h2>
<p><strong>Screenshots/Videos:</strong> Screenshot attached: Error toast message displayed in Lightning Experience</p>
<p><strong>Error Messages:</strong>
<ul>
  <li>UI Error: "An error occurred while saving the record. Review the error and try again."</li>
  <li>Debug Log: "Attempt to de-reference a null object: ContactTriggerHandler line 45"</li>
</ul>
</p>
<p><strong>Logs:</strong>
<pre>
16:23:45.123 USER_DEBUG [45]|DEBUG|Affiliation is null - cannot access Affiliation.Name
16:23:45.124 FATAL_ERROR [45]|System.NullPointerException: Attempt to de-reference a null object
Stack Trace: ContactTriggerHandler.handleAfterInsert: line 45, column 12
</pre>
</p>
<p><strong>Test Data:</strong>
<ul>
  <li>Contact ID: 003XX000004XYZ</li>
  <li>Test Contact: First Name = "Test", Last Name = "User", Email = "test@example.com", Affiliation = null</li>
  <li>Reproducible: Yes (100% of the time when Affiliation is null)</li>
</ul>
</p>
```

### Example 2: Data Sync Failure

```html
<h2>📊 Test Data and Supporting Information</h2>
<p><strong>Screenshots/Videos:</strong> N/A - API-level issue</p>
<p><strong>Error Messages:</strong> No error messages displayed. Sync job completes successfully but data does not update.</p>
<p><strong>Logs:</strong>
<pre>
Sync Job Execution Log:
2025-01-15 10:00:00 - Job started
2025-01-15 10:00:05 - Queried 1 record from Banner
2025-01-15 10:00:06 - No changes detected (Email field comparison skipped)
2025-01-15 10:00:07 - Job completed successfully
</pre>
</p>
<p><strong>Test Data:</strong>
<ul>
  <li>Contact ID: 003XX000004ABC</li>
  <li>Banner Student ID: 123456789</li>
  <li>Banner Email (before): old.email@example.com</li>
  <li>Banner Email (after): new.email@example.com</li>
  <li>Salesforce Email (current): old.email@example.com (stale)</li>
</ul>
</p>
```

## Acceptance Criteria Template

### Structure

Bug Acceptance Criteria focus on **fix validation** (WHAT should happen after fix) and **regression testing** (WHY it matters - related processes to verify). We use this two-part structure because it helps QA systematically verify that the fix works AND that it doesn't break other things.

**Important**: Bug ACs are NOT step-by-step testing instructions. They describe business behavior that proves the fix works.

### Full Template (HTML)

**CRITICAL:** Use the rich HTML template for this field. See `#file:core/templates/field-bug-acceptance-criteria.html` for the complete styled template.

The template includes:

- Fix Validation section with blue accent
- Regression Testing section with blue accent
- Given/When/Then format with visual styling

```html
<!-- See field-bug-acceptance-criteria.html for the complete styled template -->
<h2>⭐ Acceptance Criteria</h2>

<p><strong>Fix Validation (WHAT should happen after fix)</strong></p>
<ul>
  <li>
    <strong>Given</strong> [context/precondition for the fix validation],
    <strong>When</strong> [action is performed], <strong>Then</strong> [expected observable outcome]
  </li>
  <li>
    <strong>Given</strong> [edge case context that caused failure], <strong>When</strong> [action is
    performed], <strong>Then</strong> [expected outcome for edge case]
  </li>
  <li>
    <strong>Given</strong> [additional validation context], <strong>When</strong> [action is
    performed], <strong>Then</strong> [expected outcome]
  </li>
</ul>

<p><strong>Regression Testing (WHY it matters)</strong></p>
<ul>
  <li>
    <strong>Given</strong> [related business process context], <strong>When</strong> [process is
    executed], <strong>Then</strong> [expected outcome continues to work]
  </li>
  <li>
    <strong>Given</strong> [dependent component context], <strong>When</strong> [component is used],
    <strong>Then</strong> [expected behavior continues]
  </li>
  <li>
    <strong>Given</strong> [integration point context], <strong>When</strong> [integration is
    tested], <strong>Then</strong> [expected functionality works]
  </li>
</ul>
```

### Example 1: Null Pointer Exception

```html
<h2>⭐ Acceptance Criteria</h2>

<p><strong>Fix Validation (WHAT should happen after fix)</strong></p>
<ul>
  <li>
    <strong>Given</strong> a user is creating a Contact record without selecting an Affiliation,
    <strong>When</strong> the user clicks "Save", <strong>Then</strong> the Contact record saves
    successfully with the Affiliation field empty
  </li>
  <li>
    <strong>Given</strong> a Contact record is being created with Affiliation = null,
    <strong>When</strong> the ContactTriggerHandler executes, <strong>Then</strong> no null pointer
    exception occurs AND the Contact record is created
  </li>
  <li>
    <strong>Given</strong> a user is creating a Contact with an Affiliation selected,
    <strong>When</strong> the user saves the record, <strong>Then</strong> existing functionality
    continues to work AND the Affiliation name displays correctly
  </li>
</ul>

<p><strong>Regression Testing (WHY it matters)</strong></p>
<ul>
  <li>
    <strong>Given</strong> the Contact_After_Save Flow is configured, <strong>When</strong> a
    Contact is created with null or non-null Affiliation values, <strong>Then</strong> the Flow
    executes successfully without errors
  </li>
  <li>
    <strong>Given</strong> existing Contact records with Affiliations exist,
    <strong>When</strong> these records are viewed or edited, <strong>Then</strong> Affiliation
    information displays correctly AND no data loss occurs
  </li>
  <li>
    <strong>Given</strong> Contact list views and reports filter by Affiliation,
    <strong>When</strong> these views are accessed, <strong>Then</strong> they continue to work as
    expected AND show both null and non-null Affiliation records
  </li>
  <li>
    <strong>Given</strong> the Banner sync job is running, <strong>When</strong> it creates Contacts
    with or without Affiliations, <strong>Then</strong> the job completes successfully AND no sync
    errors occur
  </li>
</ul>
```

### Example 2: Data Sync Failure

```html
<h2>⭐ Acceptance Criteria</h2>

<p><strong>Fix Validation (WHAT should happen after fix)</strong></p>
<ul>
  <li>
    <strong>Given</strong> a Contact email is updated in Banner, <strong>When</strong> the sync job
    runs, <strong>Then</strong> the Salesforce Contact Email field updates within 5 minutes AND the
    sync job logs show "Email field updated"
  </li>
  <li>
    <strong>Given</strong> a Contact email is unchanged in Banner, <strong>When</strong> the sync
    job runs, <strong>Then</strong> the sync job correctly identifies no changes needed AND no
    unnecessary updates occur
  </li>
  <li>
    <strong>Given</strong> multiple Contact email changes occur in Banner, <strong>When</strong> the
    sync job processes these changes, <strong>Then</strong> all email updates are applied correctly
    to Salesforce within the expected timeframe
  </li>
</ul>

<p><strong>Regression Testing (WHY it matters)</strong></p>
<ul>
  <li>
    <strong>Given</strong> other Contact fields are being synced (Name, Phone, Address),
    <strong>When</strong> the sync job runs, <strong>Then</strong> these field syncs continue to
    work correctly AND no conflicts occur with email sync
  </li>
  <li>
    <strong>Given</strong> the Banner sync job is processing Contact records,
    <strong>When</strong> it encounters existing Contacts, <strong>Then</strong> it does not create
    duplicate Contact records AND maintains data integrity
  </li>
  <li>
    <strong>Given</strong> Salesforce-to-Banner sync is configured (if applicable),
    <strong>When</strong> updates are made from Salesforce, <strong>Then</strong> the bidirectional
    sync continues to work without conflicts AND data consistency is maintained
  </li>
  <li>
    <strong>Given</strong> Contact workflows depend on the Email field, <strong>When</strong> email
    updates are synced from Banner, <strong>Then</strong> these workflows continue to trigger
    correctly AND automation processes function as expected
  </li>
</ul>
```

## Root Cause Detail Template

### Structure

Root Cause Detail documents the root cause analysis for bugs and defects. It is populated as a hypothesis during Phase 04 (Solutioning) and trued up with confirmed findings using the Dev True-Up utility (`/util-dev-trueup`).

### Full Template (HTML)

**CRITICAL:** Use the rich HTML template for this field. See `#file:core/templates/field-bug-root-cause-detail.html` for the complete styled template.

The template includes:

- Root cause summary with category badge and confidence level
- Contributing factors list
- Evidence & references section

The template is rendered by the Nunjucks engine. Populate the JSON slot values listed below in the ticket context; the CLI renders the final HTML by evaluating the Nunjucks template (`field-bug-root-cause-detail.html`) against those values and pushes the result to ADO.

**Variables:**

| Variable                     | Type | Description                                                                       |
| ---------------------------- | ---- | --------------------------------------------------------------------------------- |
| `root_cause_summary`         | text | Concise root cause statement                                                      |
| `root_cause_category`        | text | Category: Code Defect, Configuration, Data Issue, Integration Failure, Design Gap |
| `confidence_level`           | text | Hypothesis (Phase 04), Confirmed or Probable (Dev True-Up)                        |
| `contributing_factors_items` | html | `<li>` elements listing contributing factors                                      |
| `evidence_references`        | html | HTML content with evidence sources and references                                 |

### Lifecycle

- **Phase 04 (Solutioning):** Populated with preliminary root cause hypothesis based on technical research from Phase 03. Confidence level set to "Hypothesis".
- **Dev True-Up (`/util-dev-trueup`):** Refined with confirmed root cause from PR diffs, developer input, and deployment evidence. Confidence level updated to "Confirmed" or "Probable".

### Example: Null Pointer Exception

Filled slot values for this scenario:

- `root_cause_summary`: "ContactTriggerHandler.handleAfterInsert() accesses Affiliation.Name without null check, causing NullPointerException when Contacts are created without an Affiliation."
- `root_cause_category`: "Code Defect"
- `confidence_level`: "Confirmed"
- `contributing_factors_items`: `<li>Trigger handler accesses Affiliation.Name on line 45 without null check</li><li>Recent code change added Affiliation display logic without accounting for optional relationship</li><li>Bulk data loads from Banner create Contacts without Affiliations</li>`
- `evidence_references`: `<p>Confirmed via PR #456 which adds null-safe navigation. Stack trace: ContactTriggerHandler line 45.</p>`

## Template Filling Instructions

### For AI Agents

1. **Load Research Context**: Read `{{artifact_path}}/research/` to gather:
   - Work item description and comments for actual vs expected behavior
   - Repro steps from original bug report
   - Error messages and logs from work item
   - Related components from code search
   - Similar bugs from similar work items

2. **Fill Summary Section**:
   - Extract actual vs expected behavior from work item
   - Identify affected functionality/area
   - Document business impact (who is affected, what workflows break)
   - **Do NOT** include technical root cause or fix approach

3. **Fill Repro Steps Section**:
   - Document exact environment (org, profile, browser)
   - List preconditions (setup, data, permissions)
   - Provide step-by-step instructions to reproduce
   - Clearly state Expected vs Actual results

4. **Fill System Info Section**:
   - Include screenshots/videos if available in work item
   - Copy exact error messages from UI and logs
   - Include relevant log entries or stack traces
   - Document test data used (record IDs, sample data)

5. **Fill Acceptance Criteria Section**:
   - **Fix Validation**: List observable behaviors that prove fix works
   - **Regression Testing**: List related processes/components to verify still work
   - Focus on business outcomes, not technical testing steps
   - Include edge cases that caused the original failure

6. **Fill Root Cause Detail** (Bug/Defect — rendered by Nunjucks engine):
   - Populated automatically during Phase 04 (hypothesis) and Dev True-Up (true-up)
   - Fill the following slot values in the ticket context: `root_cause_summary`, `root_cause_category`, `confidence_level`, `contributing_factors_items`, `evidence_references`
   - The CLI evaluates `field-bug-root-cause-detail.html` (a Nunjucks template) against those values and pushes the rendered HTML to ADO
   - See `#file:core/templates/field-bug-root-cause-detail.html` for the styled template and `core/templates/partials/` for shared macros

### Validation Checklist

Before applying template, verify:

- [ ] Summary describes actual vs expected behavior (not technical fix)
- [ ] Repro Steps include Environment, Preconditions, Steps, Expected/Actual
- [ ] System Info includes Error Messages (at minimum)
- [ ] Acceptance Criteria has Fix Validation section with observable outcomes
- [ ] Acceptance Criteria has Regression Testing section with related processes
- [ ] All HTML tags properly closed
- [ ] No technical solution details in Summary or AC sections

## Field Mapping

Apply templates to these fields per `field-mappings.md`:

- **Description**: `/fields/System.Description` → Summary section only
- **Repro Steps**: `/fields/Microsoft.VSTS.TCM.ReproSteps` → Step-by-step reproduction instructions
- **System Info**: `/fields/Microsoft.VSTS.TCM.SystemInfo` → Test data and supporting information
- **Acceptance Criteria**: `/fields/Microsoft.VSTS.Common.AcceptanceCriteria` → Fix validation + regression testing
- **Root Cause Detail**: `/fields/Custom.RootCauseDetail` → Root cause analysis (Nunjucks-rendered via `field-bug-root-cause-detail.html`)

**Important**: Bug ACs go in `/fields/Microsoft.VSTS.Common.AcceptanceCriteria` (same field as User Stories), NOT in Repro Steps. Repro Steps are for step-by-step reproduction instructions only.

See `field-mappings.md` for complete field path reference.
