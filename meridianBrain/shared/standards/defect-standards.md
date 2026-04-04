# Meridian — Defects & bugs

> **Meridian:** Active — Copilot `#file:shared/standards/defect-standards.md` on grooming for Bug/Defect.

Norms for **defects and bugs**: what’s broken, evidence, fixed-when, and unknowns. Not the same shape as feature or technical work items — diagnostic precision first.

**Related:** `shared/standards/refinement-standards.md` (stories and technical items), `core/knowledge/meridian-prd.md`, `core/knowledge/meridian-solution-design.md`.

**Template mapping:** Express the four sections in Bug/Defect work item fields per `core/templates/template-registry.json` (typically description, repro steps, system info, acceptance criteria). **Expected vs actual** appears **once** in WHAT’S BROKEN — do not restate the same pair across Repro and Description.

---

## 1. Principles

- **Plain language** — same readability bar as `refinement-standards.md`; optional formal test artifacts stay out of the default ticket shape.
- **Symptom first, not cause** — open with what’s wrong and what should happen; root cause belongs in investigation (see section 4).
- **Evidence is the product** — errors, logs, IDs, environment, and reproduction are the core asset; no padding or duplicate panels.
- **Brevity** — as many repro steps as needed (including zero for monitoring-only items); never fake a fixed step count.
- **No hollow sections** — omit UNKNOWNS when nothing real is unknown.
- **Self-contained** — a new reader can triage without chasing side conversations.

---

## 2. Four sections

### WHAT'S BROKEN

The **observable** problem: what users or systems see, do, or store vs what should happen. **Expected / actual** once, here. Fold in affected feature, page, automation, org, or profile **inline** with the symptom — not a separate boilerplate block.

**Title:** verb-first, scannable, ~5–8 words (same guidance as work items).

### EVIDENCE

The **diagnostic trail**. Include only what applies:

| Kind                 | Guidance                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Errors / logs        | Quote full text, stack snippets, timestamps; don’t paraphrase away detail.                                                            |
| Reproduction         | Environment and preconditions **inside** the flow; as many or few steps as needed; say if intermittent or N/A (e.g. monitoring-only). |
| Data                 | Record IDs, examples, links to records.                                                                                               |
| Screens / files      | Attach where they support the narrative.                                                                                              |
| Source               | How found (logger, alert, QA, user).                                                                                                  |
| Frequency / timeline | When it started, volume, trend.                                                                                                       |

Heavy evidence: use **group labels** (_Error output_, _Reproduction_, _Affected records_) like grouping in refinement DONE WHEN.

### FIXED WHEN

Plain-language **resolution criteria** — observable, specific, falsifiable (same quality gate as refinement **Done When**).

Typical groupings:

- **Direct fix** — bad behavior gone.
- **Regression safety** — named related behavior still works.
- **Boundaries** — out of scope or sibling work item IDs.

Every line must be **definable without already knowing root cause** (section 4).

### UNKNOWNS

Open questions: scope, cause hypotheses, data impact, approach. When cause is already clear, omit. Move answers to **Root Cause Detail** after investigation — they are not ticket filler here.

---

## 3. FIXED WHEN — quality gate

**Litmus:** Can QA (or an engineer verifying the fix) define a check **without** a follow-up question?

**Extra litmus for defects:** Is the statement true **regardless of which technical fix** ships? (Outcome-based, not “upgraded package X” unless the deliverable _is_ that upgrade as a tracked requirement.)

| Weak              | Strong                                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| “Works after fix” | “Admissions users complete dialer appointment scheduling without error; same flow as before #248281.”                 |
| “No more errors”  | “Nebula shows zero `DUPLICATE_ID_CREATED` from ActionsTriggerHelper for Action\_\_c updates in the monitored window.” |
| “Regression OK”   | “Contact Stage\_\_c updates from non-term-flip sources behave as in production prior to incident window.”             |

---

## 4. Root cause, severity, and other fields

**Root cause** is **not** one of the four sections. Capture it in **Root Cause Detail** and **Development Summary** after investigation. UNKNOWNS may list **hypotheses** only.

**Severity / priority** stay ADO metadata. The narrative should still make **impact** obvious (blocked users, volume, data at risk).

**Release notes, area path, iteration, tags** — unchanged ADO/process usage.

---

## 5. Depth and work item types

One content standard; **depth** matches problem complexity (light monitoring catch vs major incident). Multiple ADO types (e.g. Bug vs Exception Pipeline Defect) are a **process** choice — this doc applies to both.

---

## 6. Anti-patterns

**Any:** Duplicated expected/actual across fields; root cause written as fact before investigation; FIXED WHEN that only restates the implementation (“deployed hotfix branch X”).

**WHAT'S BROKEN:** Vague title (“Bug with dialer”); symptom mixed with proposed fix.

**EVIDENCE:** Missing identifiers when they exist; “steps available on request” with no pointer; empty shells.

**FIXED WHEN:** Cookie-cutter regression lines with no specific behavior; untestable vague outcomes.

---

## 7. Validation checklist

- [ ] Title verb-led ~5–8 words.
- [ ] WHAT'S BROKEN: expected/actual once; impact clear.
- [ ] EVIDENCE: complete for how the item was found; repro only if applicable.
- [ ] FIXED WHEN: section 3 litmus; outcome-based where possible.
- [ ] UNKNOWNS honest or omitted.
- [ ] Root cause not pretended as known in narrative sections.
- [ ] No duplicate expected/actual panels across ADO fields.
