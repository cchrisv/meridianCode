# User Story Templates — Meridian Modern Work Item Standard

> **Meridian:** Active — `core/config/shared.json` → `template_files.user_story`. Grooming rules: **`shared/standards/refinement-standards.md`** (Copilot `#file:` on many prompts).

Groomed **User Stories** use rich HTML from the template engine. Authoritative rules: **`shared/standards/refinement-standards.md`**.

## Overview

Each story has four narrative sections:

| Section       | ADO / template                             | Slots                                                  |
| ------------- | ------------------------------------------ | ------------------------------------------------------ |
| **What**      | `System.Description`                       | `what_text`                                            |
| **Why**       | `System.Description`                       | `why_text` (assumptions in prose here)                 |
| **Unknowns**  | `System.Description`                       | `unknowns` (optional list; omit when none)             |
| **Done When** | `Microsoft.VSTS.Common.AcceptanceCriteria` | `done_when_items` (blocks: `group_label`, `assertion`) |

**Functional** routing: `field-user-story-description.html`, `field-user-story-acceptance-criteria.html`  
**Technical** routing: `field-technical-description.html`, `field-technical-acceptance-criteria.html`

## Title

Short, verb-led, 5–8 words — set via `System.Title` / `extra_fields.title` during grooming (not a slot in the Description template).

## Done When guidelines

- Plain-English assertions: **observable, specific, falsifiable** (see standard §5.1).
- Optional `group_label` when organizing longer lists (_Expected behavior_, _Error handling_, _Boundaries_).
- No Given/When/Then labels in the ADO field — **Done When** lines only.

### Example (slot values — functional)

| Slot              | Example content                                                                                                                                                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `what_text`       | Advisors can filter the contact list by enrollment status and see an accurate count for the selected filter.                                                                                                                                                  |
| `why_text`        | Outreach campaigns lose time when advisors export and manually filter; inline filtering cuts prep time and errors. We assume enrollment status is authoritative in SIS for this release.                                                                      |
| `unknowns`        | `["Who approves copy for the empty-state message?"]` or `[]`                                                                                                                                                                                                  |
| `done_when_items` | Blocks: (_Expected_) "When Active filter is applied, only active students appear and the header count matches."; (_Error_) "When the filter request fails, inline error text appears and the list does not clear."; plus regression/boundary lines as needed. |

## HTML sources

- Description (functional): `#file:core/templates/field-user-story-description.html`
- Done When (functional): `#file:core/templates/field-user-story-acceptance-criteria.html`
- Partials: `#file:core/templates/partials/_gradient-header.html`, `_content-card.html`, `_done-when-section.html`

## Registry

Variable definitions and validation metadata: `#file:core/templates/template-registry.json` (keys `field-user-story-description`, `field-user-story-acceptance-criteria`).
