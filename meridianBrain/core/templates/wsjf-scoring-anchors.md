# WSJF Scoring Anchors

> **Meridian:** Active — `core/config/shared.json` → `template_files.wsjf_scoring` (loaded in Concern 5 WSJF).

This template provides evidence-based anchor tables for scoring WSJF (Weighted Shortest Job First) components. Use these anchors to ensure consistent, objective scoring across all work item types.

## Overview

**Formula:** `WSJF = (Business Value + Time Criticality + Risk Reduction) ÷ Job Duration`

**Scale:** Fibonacci (1, 2, 3, 5, 8, 13, 20)

**Applies To:** Bug, Defect, User Story, Enhancement

---

## Business Value (BV) - Fibonacci 1-20

Business Value measures the relative value delivered to users or the business. Score based on the highest applicable anchor.

### User Stories / Enhancements

| Score  | Anchor Description                                                                         | Evidence Indicators                                                            |
| ------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| **20** | Strategic initiative with executive sponsor, revenue-critical, competitive differentiator  | Exec sponsor named, revenue projection attached, OKR alignment documented      |
| **13** | Major capability for many users, significant competitive advantage, addresses critical gap | 100+ users impacted, market analysis provided, strategic roadmap item          |
| **8**  | Significant improvement with measurable efficiency gain, clear user demand                 | Efficiency metrics defined (e.g., "saves 2 hrs/day"), user feedback documented |
| **5**  | Moderate improvement with clear value, workaround currently exists                         | Clear use case, workaround documented but inefficient                          |
| **3**  | Minor enhancement, nice-to-have, low user visibility                                       | Limited user base, cosmetic improvement, incremental polish                    |
| **2**  | Very minor enhancement, single user request                                                | Individual request, no broader impact identified                               |
| **1**  | Cosmetic only, low visibility, no measurable impact                                        | Formatting, minor UI tweaks, documentation only                                |

### Bugs / Defects

| Score  | Anchor Description                                                          | Evidence Indicators                                                  |
| ------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **20** | Revenue/Data Loss, System Down, Security Breach, FERPA/Compliance violation | Incident ticket, revenue impact quantified, compliance team involved |
| **13** | Core function broken for many users, no workaround                          | 100+ users blocked, ITWorksEscalation tag, no alternative path       |
| **8**  | Major inconvenience, SLA at risk, degraded experience                       | SLA metrics attached, user complaints documented                     |
| **5**  | Moderate impact, workaround exists but cumbersome                           | Workaround documented, moderate user friction                        |
| **3**  | Minor impact, easy workaround available                                     | Simple workaround, limited user impact                               |
| **2**  | Very minor issue, rarely encountered                                        | Edge case, infrequent reproduction                                   |
| **1**  | Cosmetic, typo, pixel-level, no functional impact                           | Visual-only, no workflow impact                                      |

---

## Time Criticality (TC) - Fibonacci 1-20

Time Criticality measures how urgency changes the value over time. Score based on deadline pressure and consequences of delay.

| Score  | Anchor Description                                                                                  | Evidence Indicators                                               |
| ------ | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **20** | Regulatory/compliance deadline, security-critical (CVSS ≥ 9), contractual obligation with penalties | Compliance date documented, security advisory, contract reference |
| **13** | Release blocker, PI commitment, stakeholder deadline with business consequences                     | PI/Sprint goal, stakeholder communication, release dependency     |
| **8**  | Sprint commitment, approaching SLA threshold, user-facing degradation trending                      | Sprint planning evidence, SLA dashboard, escalation trend         |
| **5**  | Internal deadline, roadmap commitment, planning dependency                                          | Roadmap reference, internal milestone                             |
| **3**  | Desired but flexible timeline, nice-to-have for upcoming release                                    | Soft target date, flexible scope                                  |
| **2**  | Low time sensitivity, can be deferred                                                               | No deadline mentioned, evergreen                                  |
| **1**  | No time sensitivity, evergreen backlog item                                                         | Explicitly flexible, tech debt cleanup                            |

### TC Guardrail: Date/Event Requirement

If TC >= 8, evidence must include one of:

- Specific date or event reference
- Sprint/PI commitment documented
- SLA threshold with metrics
- Regulatory deadline citation

**If no date/event evidence exists:** Downgrade TC to 5 and add warning.

---

## Risk Reduction / Opportunity Enablement (RR/OE) - Fibonacci 1-13

RR/OE measures how this work reduces risk or enables future opportunities. Score based on downstream impact.

| Score  | Anchor Description                                                                                 | Evidence Indicators                                                  |
| ------ | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **13** | Unblocks critical path for other work, enables major release, security remediation                 | Dependency chain documented, blocked items listed, security advisory |
| **8**  | Reduces significant technical debt, enables multiple future features, prevents incident recurrence | Tech debt metrics, feature roadmap dependency, incident correlation  |
| **5**  | Enables future improvements, modest risk reduction, cleanup with benefits                          | Future work referenced, moderate risk reduction                      |
| **3**  | Minor risk reduction, localized cleanup, incremental improvement                                   | Cleanup scope limited, no downstream dependencies                    |
| **2**  | Very minor risk reduction, isolated fix                                                            | Single-point fix, no broader impact                                  |
| **1**  | Standalone work, no downstream impact                                                              | Self-contained, no dependencies or enablement                        |

### RR/OE Guardrail: Named Risk Type Requirement

If RR/OE >= 8, evidence must include at least one named risk type:

- **Security:** Vulnerability remediation, access control improvement
- **Compliance:** Regulatory requirement, audit finding
- **Data Integrity:** Data corruption prevention, accuracy improvement
- **Incident Recurrence:** Root cause fix, repeat incident prevention

**If no named risk type exists:** Add warning and require justification.

---

## Job Duration (JD) - Fibonacci 1-13

Job Duration is the fourth WSJF dimension and doubles as Story Points for sprint planning. It measures relative effort/size.

### Calculation Algorithm

Job Duration is calculated from three factors:

| Factor          | Range | Scoring Criteria                                                  |
| --------------- | ----- | ----------------------------------------------------------------- |
| **Complexity**  | 1-3   | Low=1, Medium=2, High=3 (from solution-output.json)               |
| **Risk**        | 0-3   | +1 per Well-Architected Pillar Score ≤2; +1 if "High-Risk" tag    |
| **Uncertainty** | 0-3   | +1 if Low Confidence Assumptions > 0; +1 if Traceability Gaps > 0 |

**Sum Calculation:** `Score = Complexity + Risk + Uncertainty`

**Fibonacci Mapping:**

| Sum | Job Duration |
| --- | ------------ |
| 0-1 | **1**        |
| 2   | **2**        |
| 3   | **3**        |
| 4-5 | **5**        |
| 6-7 | **8**        |
| 8+  | **13**       |

### Anchor Descriptions

| JD Score | Description                                              | Time Estimate |
| -------- | -------------------------------------------------------- | ------------- |
| **1**    | Trivial change, single component, no dependencies        | < 1 day       |
| **2**    | Simple change, clear scope, minimal testing              | 1-2 days      |
| **3**    | Moderate complexity, some dependencies, standard testing | 3-5 days      |
| **5**    | Complex change, multiple components, significant testing | 1-2 weeks     |
| **8**    | Very complex, high uncertainty, extensive testing        | 2-3 weeks     |
| **13**   | Extremely complex, multiple unknowns, full regression    | 3+ weeks      |

### Evidence Indicators

For Job Duration scoring, gather evidence for:

- **Complexity:** Number of components modified, integration points, similar past work
- **Risk:** Well-Architected pillar scores, High-Risk tag presence
- **Uncertainty:** Assumption confidence levels, traceability gaps, unknowns count

---

## Confidence Rating

For each dimension, assign a confidence level:

| Confidence | Criteria                                                          |
| ---------- | ----------------------------------------------------------------- |
| **High**   | Clear evidence, quantified metrics, validated assumptions         |
| **Medium** | Reasonable evidence, some estimation, minor assumptions           |
| **Low**    | Limited evidence, significant estimation, unvalidated assumptions |

---

## WSJF Score Interpretation

| WSJF Range | Priority | Class of Service        | Action                         |
| ---------- | -------- | ----------------------- | ------------------------------ |
| ≥ 15.0     | 1        | Expedite + WSJF-Blocker | War room - stop everything     |
| 8.0 – 14.9 | 1        | ExpediteCandidate       | Fix this sprint (skip backlog) |
| 4.0 – 7.9  | 2        | ExpediteCandidate       | Fix next sprint (skip backlog) |
| 1.5 – 3.9  | 3        | Standard                | Normal backlog prioritization  |
| < 1.5      | 4        | Standard                | Backlog or icebox              |

---

## Example Scoring

**Scenario:** Journey Pipeline configuration not updating after stage change

| Component        | Score | Evidence                                                            | Confidence |
| ---------------- | ----- | ------------------------------------------------------------------- | ---------- |
| Business Value   | 13    | 100+ Enrollment Advisors impacted, no workaround, ITWorksEscalation | High       |
| Time Criticality | 8     | Sprint commitment, SLA at risk                                      | Medium     |
| Risk Reduction   | 8     | Fixes same root cause as 2 other defects (incident recurrence)      | High       |
| Job Duration     | 3     | Moderate complexity, single flow modification                       | High       |

**Calculation:** WSJF = (13 + 8 + 8) / 3 = **9.67**

**Result:** Priority 1, Class = ExpediteCandidate, Human Review Required

---

## Human Override

When humans override WSJF scores:

1. Original score is preserved in `wsjf-evidence.json`
2. Override reason is required (one sentence minimum)
3. Subsequent re-scoring flags if recalculated differs by > 25%
4. Override persists until explicitly removed

**Override Format:**

```json
{
  "appliedBy": "Human",
  "appliedAt": "2026-02-02T12:00:00Z",
  "originalScore": 8.67,
  "newScore": 12.0,
  "reason": "Stakeholder escalation - exec sponsor requires Q2 delivery"
}
```
