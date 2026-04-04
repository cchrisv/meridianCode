# LWC Well-Architected Framework

> **Meridian:** Active — `util-pr-analysis` `#file:` for LWC PRs.

Atomic design for scalable, maintainable Salesforce interfaces. Build **systems of reusable components**, not pages.

## Seven Levels

| Level        | Format                | Data          | Logic          | Example                             |
| ------------ | --------------------- | ------------- | -------------- | ----------------------------------- |
| **Atom**     | `{app}Atom{Name}`     | Never         | Never          | `coreAtomButton`                    |
| **Molecule** | `{app}Molecule{Name}` | Never         | Coordination   | `coreMoleculeSearchBar`             |
| **Organism** | `{app}Organism{Name}` | wire/Apex     | Business rules | `emplidLoaderOrganismStudentSearch` |
| **Template** | `{app}Template{Name}` | Never         | Never          | `coreTemplateListView`              |
| **Page**     | `{app}Page{Name}`     | Orchestration | Process        | `emplidLoaderPageEmplidManager`     |
| **Utility**  | `{app}Utility{Name}`  | Varies        | Technical      | `coreUtilityFormatters`             |
| **Flow**     | `{app}Flow{Name}`     | Delegation    | Delegation     | `admissionsFlowApplicationSelector` |

**Atoms** — presentational only, `@api` in, events out.
**Molecules** — 2-5 atoms, local coordination, transform child events. No data fetching.
**Organisms** — fetch data, business rules, loading/error/empty states, cross-context (desktop/mobile/EC), FLS/sharing.
**Templates** — slot-based layouts, responsive, no content/logic.
**Pages** — templates + organisms, data orchestration, navigation.
**Utilities** — cross-cutting (caching, formatters, validators), stateless, importable by any level.
**Flow Components** — thin wrappers, delegate to organisms, `FlowAttributeChangeEvent` for Flow ↔ `@api`.

## Naming

Naming conventions are defined in `metadata-naming-conventions.md`.

## Core Principles

1. **Deep Components** — encapsulate complete experiences, don't coordinate many shallow children
2. **Natural Boundaries** — split at genuine reuse/change-rate/isolation needs. **Rule of Three:** 1st inline → 2nd copy → 3rd extract
3. **Self-Documenting** — names tell stories · JSDoc all public APIs (`@type`, `@default`, `@fires`)
4. **Unidirectional Data** — `@api` down, events up
5. **Performance-First** — centralize fetching in organisms · LDS caching · batch queries · paginate · no Apex in loops · loading states · test realistic volumes

## Level Determination

1. Cross-cutting technical? → **Utility**
2. Fetches SF data? → **Organism** or **Page**
3. Business logic + combines components? → **Organism** · Simple coordination? → **Molecule** · Neither? → **Atom**
4. Layout without content? → **Template**
5. Complete user view? → **Page**

## Code Review Checklist

**Universal:** app prefix ✓ · single purpose ✓ · `@api` documented ✓ · events documented ✓ · error handling ✓ · accessibility (ARIA, keyboard) ✓ · SLDS ✓ · naming ✓

**Per level:** Atoms: no data/state/deps · Molecules: 2-5 components, coordination only · Organisms: domain, data strategy, all states, cross-context · Templates: slots, responsive, no content · Pages: template, complete journey, navigation · Utilities: single concern, stateless, documented

## Testing

| Level     | Focus                                        |
| --------- | -------------------------------------------- |
| Atoms     | Rendering + event emission                   |
| Molecules | Coordination + event transformation          |
| Organisms | Business logic + data + loading/error states |

```javascript
export const createMockAccount = (overrides = {}) => ({
  Id: "001xx000003EXAMPLE",
  Name: "Test Account",
  Industry: "Technology",
  CustomerTier__c: "Silver",
  ...overrides,
});
```

## Migration

Audit → extract atoms (repeated UI) → identify molecules (atom groups) → refactor organisms (centralize data/logic) → create templates (common layouts).

## Anti-Patterns

| Anti-Pattern              | Fix                                      |
| ------------------------- | ---------------------------------------- |
| **God Component**         | Split by level and domain                |
| **Prop Drilling**         | Organisms fetch; LMS for cross-hierarchy |
| **Premature Abstraction** | Rule of Three                            |
| **Shallow Components**    | Deep with simple interfaces              |
| **Mixed Levels**          | Strictly follow level responsibilities   |
| **Missing App Prefix**    | Always: `coreAtomButton`                 |

→ Apex: [apex-well-architected.md] · Logging: [nebula-logger-standards.md] · Feature flags: [feature-flags-standards.md]
