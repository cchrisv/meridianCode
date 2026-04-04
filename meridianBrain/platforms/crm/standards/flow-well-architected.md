# Flow Well-Architected Framework

> **Meridian:** Active — `util-pr-analysis` `#file:` for `*.flow-meta.xml` PRs.

Nine principles in three layers. Foundation (Communication) → Design (Architecture) → Quality (Production).

## Foundation

### 1. Clear Intent Through Naming

Natural language, not codes. Descriptive (`calculateAnnualRevenue` not `crunchNumbers`) · complete words · consistent · business perspective.
→ Full standard: [metadata-naming-conventions.md]

### 2. Document Decisions and Context

Descriptions capture the **"why"**, not the "what". Preserve compliance requirements, platform workarounds, business rules, trade-offs.

- ❌ "Checks if amount > 1000" → ✅ "Orders >$1K require manual approval per compliance policy POL-2024-18."
- ❌ "Get Account record" → ✅ "LIMIT 1 — PE-triggered flows lack full record context."

### 3. Start Simple, Evolve Thoughtfully

**Rule of Three:** 1st → inline · 2nd → copy OK · 3rd → extract to reusable component.
**Evolution signals:** duplication across flows · frequent rule changes in multiple places · flow grows beyond comfortable size.

## Design

### 4. Deep Flows Over Shallow Complexity

Deliver complete business value. One-sentence user-perspective test: ✅ "Onboards new customers" not ❌ "Updates account, creates task, sends email."

### 5. Performance-First

**Never DML/SOQL in Loops.** Think in collections. Test with realistic volumes.

- Filter in query (not after) · select only needed fields · relationship queries · always use entry criteria
- 100 SOQL / 150 DML per transaction · CPU multiplies in loops

### 6. Modularity Through Subflows

Reusable components with clear inputs/outputs. Candidates: validation · calculations · integration · notifications.
→ Full standard: [flow-subflow-usage.md]

### 7. Cohesive Organization

Organize by **business domain**, not technical triggers. No "god flows."

```
Instead of: Case - After - Handle all updates (dozens of branches)
Create: Case - After - Support escalation to management (entry: Type='Support' AND Status→'Escalated')
        Case - After - Warranty claim processing (entry: Type='Warranty' AND Status='Submitted')
```

## Quality

### 8. Error Handling (First-Class)

**Three-step pattern:**

1. **Capture** — `textErrorMessage` with user-friendly message
2. **Log** — Nebula Logger: where, what, context, severity
3. **Respond** — Screen: error screen · Record-triggered: custom error · Scheduled: admin notification · Integration: retry/alert

### 9. Testability

Strategic checkpoints · test: happy path + edge cases + errors + data variations · predictable behavior · representative test data.

## Common Patterns

| Pattern             | Structure                                                                            |
| ------------------- | ------------------------------------------------------------------------------------ |
| **Orchestration**   | Main → validate → check availability → process payment → calculate shipping → notify |
| **Data Validation** | Subflow checks all rules → returns `isValid` + `errorMessages`                       |

## Anti-Patterns

| Anti-Pattern                 | Fix                                                 |
| ---------------------------- | --------------------------------------------------- |
| **Monolith** (150+ elements) | Group logically → extract subflows → orchestrator   |
| **Spaghetti** (8+ outcomes)  | Multiple simple decisions → subflows → linear paths |
| **Silent Failer**            | Fault paths on every DML → three-step error → log   |

→ Naming: [metadata-naming-conventions.md] · Subflows: [flow-subflow-usage.md] · Feature flags: [feature-flags-standards.md]
