# Meridian — Work items & refinement

> **Meridian:** Active — Copilot `#file:shared/standards/refinement-standards.md` (grooming, refinement review, apply-template).

Norms for **WHAT / WHY / DONE WHEN / UNKNOWNS**, **functional vs technical** classification, and grooming checks.

**Related:** `core/knowledge/meridian-prd.md`, `core/knowledge/meridian-solution-design.md`. **Defects / bugs:** `shared/standards/defect-standards.md`.

When scope includes **automation**, also apply **`operational-context-matrix.md`** (OCM → Done When lines or explicit out-of-scope).

---

## 1. Principles

- **Plain language in ADO** — readable WHY/WHAT for business readers; DONE WHEN precise enough for engineering and QA. Optional formal test artifacts stay out of the default ticket shape.
- **One ticket, two audiences** — no jargon in WHY; no vague DONE WHEN.
- **Brevity** — long WHAT usually means split the work.
- **No hollow sections** — no placeholders; omit UNKNOWNS when empty.
- **Task-focused WHAT** — not a persona-story block as the main shape; persona depth lives outside the ticket.
- **Solution design holds “how”** — clear problem and boundaries in the work item; avoid specifying implementation unless the deliverable _is_ that artifact.
- **Self-contained** — scope, motivation, done state, and boundaries obvious without chasing other fields.

---

## 2. Four sections (template slots)

Maps to **`what_text`**, **`why_text`**, optional **`unknowns`**, **`done_when_items`** (Meridian HTML templates).

### WHAT

Verb-led **title** (~5–8 words), not a story sentence. Body: deliverable, outcome first; links inline. **Shaping constraints** (limits, platform facts) here; **implementation choices** → solution design. Overlong WHAT → split.

### WHY

Pain, risk, opportunity, compliance. Assumptions in **prose** (no assumptions table). Quote sourced feedback. Missing “why we care” → not sprint-ready.

### DONE WHEN

Finish line: happy path, material edges, error handling, boundaries (out of scope, sibling IDs). Natural _condition → outcome → detail_ lines. Optional group labels (_Expected behavior_, _Error handling_, _Boundaries_) when **~5+** lines; flat list when fewer. Each line meets section 3.

### UNKNOWNS

Open questions; **who can answer** when known. Omit when none.

---

## 3. Done When — quality gate

Observable, **specific**, **falsifiable**.

**Litmus:** Can QA define a check **without** a follow-up question?

| Weak                        | Strong                                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| “Handles errors gracefully” | “If support item creation fails, the error is logged with student name, term, error list, and timestamp, and an admin alert is sent” |
| “Performance acceptable”    | “API response time stays under 200ms at P95 under current production load”                                                           |
| “Created correctly”         | “One support item per failed registration attempt regardless of how many course errors”                                              |

Grooming owns **what / why / done**; solution design owns **how**. Derive detailed tests from DONE WHEN when needed.

---

## 4. Functional vs technical

| Type           | Definition                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| **Functional** | A non-technical person would notice: UI, workflow, notification, perceived performance.               |
| **Technical**  | No user-visible behavior change: internals, APIs, migrations, reliability, security, platform health. |

**Decision order:** (1) User-visible effect? → functional. (2) Contract change for other systems/devs? → technical. (3) Health-only? → technical. (4) Ambiguous? Draft DONE WHEN for user experience vs system-only measures; **split** into two linked items if both apply.

**Gray:** Visible change + heavy build → **functional** (build detail in solution design). Slowness users feel → **functional** + threshold in DONE WHEN. Debt/refactor → **technical** + quantified WHY. Data migration → **technical**; new capability after migration → separate functional item if user-visible.

### Emphasis by type (same four slots)

| Slot          | Functional                                                                                   | Technical                                                                                                  |
| ------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **WHAT**      | Outcome-first; business-readable                                                             | System change and contracts; precision OK; avoid implementation names unless deliverable _is_ the artifact |
| **WHY**       | Stakeholder language                                                                         | Quantified: incidents, time, latency, errors, blocked work                                                 |
| **DONE WHEN** | Stakeholder-**observable** (messages, empty states, permissions) — not internal counts alone | **Measurable**: latency, throughput, errors, contracts, regressions, boundaries                            |

**Solution neutrality:** Apex/LWC/SOQL/trigger choices → solution design unless they define the stated deliverable (e.g. “field X in API response”).

---

## 5. INVEST

All six apply to functional work. Technical: **Negotiable** often weaker; the rest still apply. Split if DONE WHEN exceeds ~10 strong lines without natural grouping.

---

## 6. Tags (optional)

Default is plain DONE WHEN only. Use `@`-style tags only when required for external test tooling; follow team conventions (e.g. happy-path, edge-case, error-handling, regression, smoke, compliance, permissions, performance, integration, security).

---

## 7. Quality target: exceeds expectations

Only when DONE WHEN already carries **evidence-level** precision: explicit thresholds, messages, and boundaries — not extra template sections.

---

## 8. Anti-patterns

**Any:** `[TBD]`; missing WHY; “Implement X” with no done state; implementation detail in WHAT/WHY/DONE WHEN unless the artifact _is_ the deliverable.

**Functional:** Persona block as entire WHAT; jargon-only WHY; DONE WHEN only engineers can verify for user-facing work.

**Technical:** Vague WHY; non-measurable DONE WHEN; developer user-story phrasing as the whole WHAT.

**DONE WHEN:** Missing happy/edge/error/boundary coverage when it matters; phrases like “works correctly”; mixed user-visible and purely internal measures without split.

---

## 9. Validation checklist

- [ ] Type correct (section 4).
- [ ] No placeholders; title verb-led ~5–8 words.
- [ ] WHAT and WHY substantive; WHY states why we care.
- [ ] DONE WHEN passes section 3; group only when helpful.
- [ ] UNKNOWNS honest or omitted.
- [ ] “How” in solution design except shaping constraints.
- [ ] Functional: stakeholders can verify visible outcomes.
- [ ] Technical: quantified WHY; measurable DONE WHEN.
- [ ] OCM applied when automation is in scope.
- [ ] “Exceeds” only where section 7 applies.
