# Solution Design Template - Digital Platforms Project

> **Meridian:** Active — `core/config/shared.json` → `template_files.solution_design`.

Reference guide for the Development Summary field in Azure DevOps. The actual HTML rendering is handled by the Nunjucks engine via `field-solution-design.html` — this document provides structural guidance only.

## Overview

The Development Summary is the developer's primary reference document for building the solution. It serves two audiences:

1. **Business stakeholders:** Need to understand what we're building, why this approach, and how it addresses the acceptance criteria.
2. **Developers:** Need the full technical design — method signatures, field mappings, implementation steps, patterns, standards applied, risks, and test approach.

The tone is educational and decision-explaining. It includes full implementation detail — enough for a developer to build without needing to ask clarifying questions.

## Template Structure (4 Sections)

### Section 1: What We're Building (Teal Gradient)

- `what_we_are_building` (html) — Summary of what's being built, including "Why This Approach" and "Architectural Pattern" subsections. Lists key artifacts (new classes, flows, test classes). Uses paragraphs, bold text, bullet lists, and subsection labels.
- `acceptance_criteria_mapping` (table) — Maps each AC to how the solution addresses it in business-readable language.

### Section 2: Solution Design (Purple Gradient)

- `legacy_analysis` (html, optional) — Critical issues in existing implementation. Numbered items categorized by type (timing, dead code, complexity, security, logging, naming) with "Why This Matters" explanations. Omit entirely for net-new solutions.
- `technical_design` (html) — Full technical design with method-level detail: method signatures (name, visibility, parameters, return type, CC target), field-level mapping tables (API name, type, before/after), patterns and algorithms, constants, helper method extraction. This is the main body of the document.
- `components` (table) — Component overview with accessible Purpose descriptions.
- `integration_points_brief` (text, optional) — System boundaries and connections.

### Section 3: Implementation Plan (Indigo Gradient)

- `implementation_plan` (html) — Detailed phase-by-phase plan with numbered steps. Each phase has a Goal statement and specific deliverables: method specs, field lists, configuration details, "Not carried over" inventory tables. Enough detail to implement without clarifying questions.
- `implementation_order` (html, optional) — Dependency diagram in `<pre>` tags showing phase relationships and parallel tracks. Lists affected flows/components requiring refactoring.

### Section 4: Quality & Risk (Steel Gradient)

- `standards_traceability` (table) — Maps each applied standard to how it is concretely implemented (specific rules, not generic statements).
- `risk_considerations` (table) — Risk and mitigation pairs covering coexistence with legacy, rollout strategy, governor limits, downstream dependencies.
- `test_approach` (html, optional) — Test class name, coverage categories (happy/negative/edge/security/automation/integration), key test scenarios, static analysis commands.
- `key_considerations` (html, optional) — Additional notes, assumptions, scope boundaries not covered elsewhere.

## Content Guidelines

### Do

- Include method names, visibility, parameters, return types, and CC targets
- List field API names with before/after behavior (e.g., "null → recalculated", "stale → reset to 0")
- Name patterns used (e.g., "map-based accumulation", "guard clause + early return")
- Document what is NOT carried over from legacy and why
- Include "Not carried over" tables with Category/Items Removed columns
- Include field-level mapping tables (Type/Fields columns)
- Explain WHY each decision was made, not just WHAT
- Use inline HTML tables within `html` type slots for structured data
- Use `<pre>` tags for ASCII dependency diagrams
- Map every AC to a concrete "How It's Addressed" value
- Include specific test scenarios per coverage category

### Don't

- Reference internal filenames or file paths (e.g., "per trigger-actions-framework-standards.md")
- Include level of effort, story points, timeframes, or duration estimates
- Use generic standards statements (e.g., "follows best practices")
- Write a single run-on paragraph for any html slot
- Omit critical issues when modifying legacy code
- Leave method designs vague — include signatures and patterns

## Nunjucks Template Integration

The template is rendered by the Nunjucks engine. The AI fills JSON slot values; the CLI renders HTML:

1. AI fills slot values (html, tables, text) into the ticket context under `filled_slots`
2. The CLI evaluates `field-solution-design.html` (a Nunjucks template using `{% %}` / `{{ }}` syntax) against those values, validates the output, and pushes to ADO
3. Shared macros (e.g., gradient headers, data tables, callout cards) are imported from `core/templates/partials/`

## Validation Checklist

- [ ] "What We're Building" includes Why This Approach and Architectural Pattern subsections
- [ ] Every acceptance criterion maps to a "How It's Addressed" entry
- [ ] Legacy analysis covers all critical issues when modifying existing code
- [ ] Technical design includes method signatures with CC targets
- [ ] Technical design includes field-level mapping tables
- [ ] Implementation plan has numbered steps per phase with specific deliverables
- [ ] Implementation plan includes "Not carried over" inventories where applicable
- [ ] Implementation order shows dependency diagram
- [ ] Standards traceability has specific (not generic) rule applications
- [ ] Risk table covers coexistence, rollout, governor limits, and downstream dependencies
- [ ] Test approach lists specific scenarios per coverage category
- [ ] No internal file references, local paths, or repository artifacts
- [ ] No LOE, timeframes, story points, or complexity ratings in rendered output
