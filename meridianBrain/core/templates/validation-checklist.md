# Template Validation Checklist - Digital Platforms Project

> **Meridian:** Active — `core/config/shared.json` → `template_files.validation`. Optional human/process gate; not a hard `template-tools` validator today.

Template validation rules to ensure complete, correct, and high-quality work item templates before advancing to the next phase.

## Purpose

This checklist prevents incomplete or incorrect templates from advancing through the workflow. If validation fails, the workflow halts and tags the work item for review.

## User Story Validation

### Description Field Validation

**Required Sections (All 5 Must Be Present):**

- [ ] **Summary** section exists and contains 1-2 sentences
- [ ] **User Story** section exists and uses "As a / I want / so that" format
- [ ] **Goals & Business Value** section exists with at least 2 measurable goals
- [ ] **Assumptions & Constraints** section exists with both Assumptions and Constraints subsections
- [ ] **Out of Scope** section exists with at least 1 item

**Content Quality Checks:**

- [ ] No `[TO_BE_DETERMINED]` placeholders remain in any section
- [ ] No `[FOR EACH ASSUMPTION]` or similar template markers remain
- [ ] Summary focuses on WHAT and WHY (no HOW/technical details)
- [ ] No solution-scent tokens present (architecture/technology names, patterns, verbs like "implement/design/build")
- [ ] User Story includes specific persona (not generic "user")
- [ ] Goals include measurable outcomes (metrics, percentages, KPIs)
- [ ] Assumptions table rendered if assumptions exist in `research/assumptions.json`
- [ ] If no assumptions exist, shows "No technical assumptions captured during research."
- [ ] Constraints list has at least 1 item (platform, business, or integration constraint)
- [ ] Out of Scope list has at least 1 item (prevents scope creep)
- [ ] Collaborative tone used in Description (explanations of WHY, not just WHAT)
- [ ] Language is mentoring-focused, not directive

**HTML Structure Validation:**

- [ ] All HTML tags properly closed
- [ ] Header hierarchy correct (`<h2>` → `<h3>`)
- [ ] Lists use `<ul>` or `<ol>` with `<li>` items
- [ ] Tables use proper structure (`<table>`, `<tr>`, `<th>`, `<td>`)
- [ ] No malformed HTML (unclosed tags, nested incorrectly)

### Acceptance Criteria Field Validation

**Required Structure:**

- [ ] Minimum 3 scenarios present (aim for 4-6)
- [ ] Each scenario uses Given/When/Then (GWT) format
- [ ] Each scenario has unique title/h3 header
- [ ] All scenarios follow GWT structure (not mixed formats)

**Content Quality Checks:**

- [ ] Happy path scenario included (primary use case)
- [ ] Edge case scenario included (empty data, boundary conditions)
- [ ] Error handling scenario included (invalid input, failure conditions)
- [ ] Regression scenario included (related components still work)
- [ ] All outcomes are observable/measurable (no subjective language)
- [ ] No technical implementation details in ACs (focus on behavior)
- [ ] No solution-scent tokens present (architecture/technology names, patterns, verbs like "implement/design/build")
- [ ] ACs reference business goals from Description

**GWT Format Validation:**

- [ ] Each scenario has `<strong>Given</strong>` clause with initial context
- [ ] Each scenario has `<strong>When</strong>` clause with user action
- [ ] Each scenario has `<strong>Then</strong>` clause with expected outcome
- [ ] Given/When/Then clauses are on separate lines with `<br/>` breaks
- [ ] Outcomes use observable results (field values, record counts, error messages)

**HTML Structure Validation:**

- [ ] All scenarios wrapped in `<h3>` headers
- [ ] GWT clauses use `<strong>` tags correctly
- [ ] Line breaks use `<br/>` (self-closing)
- [ ] No malformed HTML

### INVEST Criteria Validation

**Independent:**

- [ ] Story can be understood without referencing other work items
- [ ] No "depends on Story #X" language in Description
- [ ] Story delivers value independently

**Valuable:**

- [ ] Goals section states measurable business outcome
- [ ] Value is clear to stakeholders (not just technical debt)
- [ ] Business impact is explicit

**Estimated:**

- [ ] Scope is bounded (no "TBD" in Assumptions)
- [ ] AC count ≤ 10 scenarios (small enough to estimate)
- [ ] No "details to be decided in solutioning" appears 3+ times

**Small:**

- [ ] AC count ≤ 10 scenarios
- [ ] Scope is reasonable for a single work item
- [ ] Fits within typical sprint scope

**Testable:**

- [ ] All ACs use Given/When/Then format
- [ ] Success criteria are observable (not subjective)
- [ ] No vague language: "performs well", "handles properly", "user is satisfied"

## Bug/Defect Validation

### Description Field Validation

**Required Structure:**

- [ ] Summary section exists (single section only, not 5-section template)
- [ ] Summary describes actual vs expected behavior
- [ ] Summary identifies affected functionality/area
- [ ] Summary documents business impact

**Content Quality Checks:**

- [ ] No technical root cause speculation in Summary
- [ ] Focus on WHAT is broken, not HOW to fix
- [ ] Business impact clearly stated (who is affected, what workflows break)
- [ ] No `[TO_BE_DETERMINED]` placeholders
- [ ] Collaborative tone used (explanations of WHY, not just commands)

### Repro Steps Field Validation

**Required Structure:**

- [ ] Environment information provided (org, profile, browser)
- [ ] Preconditions listed (setup, data, permissions)
- [ ] Step-by-step instructions provided (numbered list)
- [ ] Expected vs Actual results clearly stated

**Content Quality Checks:**

- [ ] Steps are specific and actionable (not vague)
- [ ] Steps are ordered sequentially (1, 2, 3...)
- [ ] Expected result describes what SHOULD happen
- [ ] Actual result describes what ACTUALLY happens (error, wrong behavior)
- [ ] Repro steps enable QA to reproduce the bug

### System Info Field Validation

**Required Structure:**

- [ ] Field exists and is populated
- [ ] At minimum, Error Messages section included

**Content Quality Checks:**

- [ ] Error messages copied exactly (not paraphrased)
- [ ] Logs include relevant entries (not entire log files)
- [ ] Test data includes record IDs or sample data
- [ ] Screenshots/Videos referenced if available

### Acceptance Criteria Field Validation

**Required Structure:**

- [ ] Fix Validation section exists with observable behaviors
- [ ] Regression Testing section exists with related processes
- [ ] ACs focus on behavior verification (not step-by-step testing)

**Content Quality Checks:**

- [ ] Fix Validation lists what SHOULD happen after fix (observable outcomes)
- [ ] Fix Validation includes edge case that caused failure
- [ ] Regression Testing lists related business processes to verify
- [ ] Regression Testing lists dependent components to test
- [ ] No step-by-step testing instructions (that's QA's job)
- [ ] All outcomes are observable/measurable

**Important**: Bug ACs are NOT step-by-step scenarios. They describe business behavior that proves the fix works.

## Cross-Phase Validation

### Field Path Validation

- [ ] All field paths use `/fields/` prefix (per `field-mappings.md`)
- [ ] Field paths match ADO schema exactly (case-sensitive)
- [ ] Custom fields use `Custom.` prefix
- [ ] System fields use `System.` prefix
- [ ] Microsoft fields use `Microsoft.VSTS.` prefix

### Classification Validation

- [ ] Work Class Type set to valid value (Development, Critical/Escalation, Fixed Delivery, Maintenance/Recurring Tasks, Standard)
- [ ] Requires QA set to "Yes" or "No"
- [ ] Tags include base tags: `Triaged;CoPilot-Refined`
- [ ] Tags include Work Type: `Admin` OR `Dev` (not both)
- [ ] Tags include Effort: `Low-Effort`, `Medium-Effort`, or `High-Effort`
- [ ] Tags include Risk: `Low-Risk`, `Medium-Risk`, or `High-Risk`
- [ ] Tags formatted as semicolon-delimited string (not array)

## How to Validate

### For AI Agents

1. **After Template Application**:
   - Load applied templates from `grooming/templates-applied.json`
   - Run validation checklist for appropriate work item type (User Story or Bug)
   - Check each item in the checklist

2. **If Validation Fails**:
   - Add tag `Template-Incomplete` to work item
   - Document missing sections in `classification.json` → `validationFailures` array
   - Halt workflow (do not proceed to next phase)
   - **Do NOT post a comment** - Comments are STRICTLY PROHIBITED unless explicitly requested by the user. Document failures in artifacts instead.

3. **If Validation Passes**:
   - Document validation results in `classification.json` → `validationResults`
   - Continue to next phase (solutioning for User Stories, or finalization if solutioning complete)

### Validation Failure Example

```json
{
  "validationResults": {
    "passed": false,
    "failures": [
      {
        "section": "Description",
        "issue": "Out of Scope section missing",
        "severity": "blocking"
      },
      {
        "section": "Acceptance Criteria",
        "issue": "Only 2 scenarios present, minimum 3 required",
        "severity": "blocking"
      }
    ],
    "tagsApplied": ["Template-Incomplete"]
  }
}
```

### Validation Success Example

```json
{
  "validationResults": {
    "passed": true,
    "checksPerformed": 25,
    "checksPassed": 25,
    "workItemType": "User Story",
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
```

## Quick Reference

### User Story Must-Haves

✅ 5 Description sections (Summary, User Story, Goals, Assumptions, Out of Scope)  
✅ Minimum 3 AC scenarios in GWT format  
✅ Assumptions table if assumptions exist  
✅ All placeholders replaced with actual content  
✅ INVEST criteria pass

### Bug Must-Haves

✅ Summary section (actual vs expected)  
✅ Repro Steps (Environment, Preconditions, Steps, Expected/Actual)  
✅ System Info (Error Messages minimum)  
✅ AC with Fix Validation + Regression Testing  
✅ All placeholders replaced with actual content

## Common Validation Failures

1. **Missing Sections**: Description missing Out of Scope or Assumptions
2. **Placeholders Remain**: `[TO_BE_DETERMINED]` or `[FOR EACH ASSUMPTION]` still present
3. **Insufficient ACs**: Only 1-2 scenarios when 3+ required
4. **Poor GWT Format**: ACs don't follow Given/When/Then structure
5. **Technical Jargon**: Summary or User Story includes component names, technical patterns
6. **Missing Edge Cases**: ACs only cover happy path, no error handling
7. **Subjective Outcomes**: ACs use vague language like "performs well"
8. **Malformed HTML**: Unclosed tags, incorrect nesting

## Remediation

If validation fails:

1. **Identify Missing Elements**: Review checklist and note all failures
2. **Fix Templates**: Fill missing sections, replace placeholders, fix HTML
3. **Re-validate**: Run checklist again after fixes
4. **Remove Tag**: Once validation passes, remove `Template-Incomplete` tag
5. **Document**: Update `classification.json` with validation results
