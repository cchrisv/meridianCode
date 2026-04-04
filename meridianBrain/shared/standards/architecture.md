# Architecture reference

> **Meridian:** Active — Copilot `#file:shared/standards/architecture.md` (e.g. `util-pr-analysis` baseline; agent references).

Internal architecture of **Meridian** (Platform Engineering Company OS). For AI agents and developers.

**Authoritative sources:** [`core/knowledge/meridian-prd.md`](../../core/knowledge/meridian-prd.md) (requirements) · [`core/knowledge/meridian-solution-design.md`](../../core/knowledge/meridian-solution-design.md) (repo contract, Copilot integration, migration). This document summarizes how the repository is structured and how pieces fit together day to day.

---

## 1. System overview

Meridian is an **IDE-first** GitHub repository — not a separate web app. Engineers use **GitHub Copilot** (or Cursor, etc.), structured **prompts**, **agents**, **skills**, and **Node CLI tools** to work **Azure DevOps** tickets and connected platforms (CRM first; marketing automation, contact center, portal, and others on the roadmap per the PRD).

| External system                  | CLI suite                                                                             | Purpose                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Azure DevOps                     | `ado-tools`                                                                           | Work items, wiki, backlog, iterations                                      |
| Salesforce (CRM)                 | `crm-tools`                                                                           | SOQL, describe, discovery, org roles                                       |
| GitHub                           | `pr-tools`                                                                            | Pull requests, diffs, linked work items                                    |
| Microsoft Graph                  | `team-tools`                                                                          | Org / team discovery                                                       |
| —                                | `wiki-tools`, `workflow-tools`, `template-tools`, `wiki-engine-tools`, `report-tools` | Wiki, lifecycle, HTML templates, block wiki engine, activity CSV           |
| Knowledge & integrations         | `knowledge-tools`, `integration-tools`                                                | Search `knowledge/` roots; registry under `shared/knowledge/integrations/` |
| Non-CRM platforms (stubs → grow) | `marketing-automation-tools`, `contact-center-tools`, `portal-tools`                  | Platform depth as manifests and tools mature **(PRD: MP-2, MP-4)**         |

| Auth       | Mechanism                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| ADO        | Azure CLI (`az login`) → bearer token in CLI                                                            |
| Salesforce | SF CLI (`sf org login web`) → `platforms/crm/config/crm-orgs.json` (gitignored) + `crm-tools org-setup` |

---

## 2. Product alignment (PRD trace)

| Theme                         | IDs              | Architecture implication                                                                                                                                                        |
| ----------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Unified workflow**          | MP-1             | Same `ticket-context.json` pattern and CLI orchestration; primary prompt `workflow-initial-copilot-grooming.prompt.md`                                                          |
| **Platform extensions**       | MP-2, MP-3, MP-4 | Each domain: `platforms/<name>/` + `platform.json`; Copilot assets under `.github/prompts/platforms/<name>/`, `.github/skills/platforms/<name>/`; flat **prefixed** agents only |
| **Knowledge**                 | KC-\*            | Three knowledge roots (`core/knowledge`, `shared/knowledge`, `platforms/*/knowledge`); eight-domain org graph in design; `knowledge-tools search` across markdown roots         |
| **Cross-platform visibility** | CV-\*            | `shared/knowledge/integrations/` + `integration-tools`; workflow may set `detectedIntegrations` / `crossPlatformImpacts` in context **(design §8, §14)**                        |
| **IDE & resilience**          | AX-1, AX-3       | Everything file-based; platform tool failure must not block core ADO/grooming path                                                                                              |
| **Safeguards & audit**        | SG-\*            | `core/safeguards.json`; optional audit stream under `core/.ai-artifacts/audit/` **(design §14)**                                                                                |

---

## 3. Two layers

**Layer A — Copilot interface (GitHub-enforced paths).** Copilot only discovers:

- `.github/copilot-instructions.md`
- `.github/prompts/**/*.prompt.md`
- `.github/agents/*.agent.md` (**flat directory** — no subfolders; use `crm-`, `marketing-automation-`, … prefixes)
- `.github/skills/**/SKILL.md`

Subfolders inside prompts/skills mirror **core / shared / platforms** for mental model consistency.

**Layer B — Content pillars (everything else).**

| Pillar              | Role                                                                                                                               |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `core/`             | Engine: `config/`, `scripts/workflow/`, `templates/`, `knowledge/`, `standards/`, `safeguards.json`, runtime `core/.ai-artifacts/` |
| `shared/`           | Org-wide standards, shared knowledge graph roots (`shared/knowledge/`, integrations registry)                                      |
| `platforms/<name>/` | Per-platform `platform.json`, `config/`, `-knowledge/`, `standards/`, `templates/`                                                 |

Think: **`.github/` = steering wheel; pillars = engine, fuel, tires** (see solution design §2.2).

---

## 4. Directory structure (current shape)

```
meridian/
├── .github/
│   ├── copilot-instructions.md
│   ├── prompts/
│   │   ├── core/                    # workflow-initial-copilot-grooming, util-*, …
│   │   ├── shared/
│   │   └── platforms/
│   │       └── crm/                 # feature-research-*, …
│   ├── agents/                      # *.agent.md — flat only
│   └── skills/
│       ├── core/ | shared/ | platforms/
│
├── core/
│   ├── config/
│   │   ├── shared.json              # single source of truth: paths, cli_commands, ADO defaults, …
│   │   └── local.json.example     # optional overrides (local.json gitignored)
│   ├── knowledge/                 # how Meridian works + meridian-prd / meridian-solution-design
│   ├── standards/                 # refinement / ADO-adjacent conventions
│   ├── templates/                 # Nunjucks HTML, template-registry.json, ticket-context-schema.json
│   ├── scripts/workflow/          # CLI package: cli/, src/, npm run build | test
│   ├── safeguards.json
│   └── .ai-artifacts/             # gitignored — ticket-context, reports, audit
│
├── shared/
│   ├── standards/                 # share-core.md, architecture.md, organization-dictionary.json, …
│   ├── knowledge/                 # org graph: integrations/, domains per design
│   └── config/
│
├── platforms/
│   ├── crm/
│   │   ├── platform.json
│   │   ├── config/                # crm-orgs.example.json; crm-orgs.json gitignored
│   │   ├── knowledge/ | standards/ | templates/
│   ├── marketing-automation/ | contact-center/ | portal/
│   │   └── platform.json, …
│
├── docs/                          # optional human docs: standards/, brand/, decks/
├── README.md
└── .gitignore
```

`force-app/` or other Salesforce DX trees may exist alongside; they are product source, not the Copilot engine.

---

## 5. Configuration (`core/config/shared.json`)

Single source of truth: **read-only** for prompts at runtime. TypeScript loads via `configLoader` (`loadSharedConfig`, `getProjectRoot`, CLI command helpers).

**Important sections:** `version` · `project` · `ado_defaults` · `sf_defaults` (`org_config` → `platforms/crm/config/crm-orgs.json`) · `paths` · `cli_commands` · `work_item_types` · `field_paths` · `template_files` · `artifact_files` · `tags` · `flow_health` · …

**CRM org file:** `platforms/crm/config/crm-orgs.json` (gitignored). Template: `crm-orgs.example.json`. Roles include `primary`, `legacy`, `modern`, legacy/modern data & metadata splits, `dataCloud`. Wizard: `crm-tools org-setup`.

**Prompt variables** (examples):

| Pattern                    | Role                                                                         |
| -------------------------- | ---------------------------------------------------------------------------- |
| `{{cli.<key>}}`            | Full command prefix, e.g. `npx --prefix core/scripts/workflow ado-tools get` |
| `{{paths.<key>}}`          | `artifacts_root`, `templates`, `knowledge.core`, …                           |
| `{{field_paths.<key>}}`    | ADO field reference names                                                    |
| `{{template_files.<key>}}` | Template keys from registry                                                  |

**Rule:** No hardcoded paths or CLI strings in prompts — use `shared.json` and `#file:core/config/shared.json` / share blocks.

---

## 6. Workflow model

**Primary entry:** `/workflow-initial-copilot-grooming` (`workflow-initial-copilot-grooming.prompt.md`) — unified **Discover → Refine → Solve → Size → Publish** concerns mapped onto one `ticket-context.json`.

**Context file:** `core/.ai-artifacts/<work_item_id>/ticket-context.json`  
Sections typically include `metadata`, `run_state`, `research`, `grooming`, `solutioning`, `finalization`, `dev_updates`, `closeout`. Schema reference: `core/templates/ticket-context-schema.json`.

**Lifecycle CLI:**

- `workflow-tools prepare|status|reset` — initialize, inspect, or clear phases (see tool help for valid phase keys).
- After `reset`, re-run the **unified** grooming prompt so checkpoints resume correctly.
- `util-repeat-phase` — resets a named phase then directs engineer back to unified workflow.

**Post-development:** `util-dev-trueup` and incremental utilities (`util-grooming-update`, `util-solutioning-update`, …) work from ADO + context as documented in their prompts.

**Separation:** Grooming / requirements (**what & why**) vs solutioning (**how**) — do not cross-write fields; see **`shared/standards/refinement-standards.md`**.

---

## 7. Prompt architecture

**Composable share blocks** — each prompt declares `#file:…` references on its Config line.

| Block         | Location                                                                        | Purpose                                                  |
| ------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Core patterns | `shared/standards/share-core.md`                                                | Step tags `[CLI]`, `[GEN]`, `[IO]`, guardrails, recovery |
| ADO / context | `core/knowledge/share-ado.md`                                                   | ticket-context lifecycle, phase map, CLI cheat sheet     |
| Domain slices | `core/knowledge/share-ado-*.md`, `platforms/crm/knowledge/share-salesforce*.md` | Research, update, wiki, backlog, CRM                     |

**Standard prompt shape:** title → Role/Mission → Config (blocks + input vars) → Prerequisites → Steps → Output.

**Global guardrails:** no unsolicited ADO comments unless prompt says otherwise · CLI-only from `shared.json` · no hardcoded paths · treat config as read-only unless explicitly editing · load config / share blocks before destructive steps.

---

## 8. CLI tools

**Invocation pattern:**

```bash
npx --prefix core/scripts/workflow <tool> <command> [options] --json
```

Build and test from **`core/scripts/workflow`:** `npm run build`, `npm test` (Vitest).

| Tool                         | Typical commands                                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `workflow-tools`             | prepare, status, reset                                                                                            |
| `ado-tools`                  | get, update, create, search, backlog, reorder, reorder-bulk, backlog-validate, link, unlink, relations, iteration |
| `crm-tools`                  | query, describe, discover, apex-\*, flows, validation-rules, custom-objects, org-setup, org-status, org-validate  |
| `wiki-tools`                 | get, update, create, search, list, delete, upload-attachment                                                      |
| `pr-tools`                   | get, diff, threads, work-items, list                                                                              |
| `report-tools`               | activity                                                                                                          |
| `team-tools`                 | discover                                                                                                          |
| `template-tools`             | list, scaffold-phase, render-phase, validate, info                                                                |
| `wiki-engine-tools`          | block-menu, render, validate, colors                                                                              |
| `knowledge-tools`            | search, ingest (stub — prefer guided prompts for full ingest)                                                     |
| `integration-tools`          | list, get, trace (evolving)                                                                                       |
| `marketing-automation-tools` | stub — aligns to `platform.json`                                                                                  |
| `contact-center-tools`       | stub                                                                                                              |
| `portal-tools`               | stub                                                                                                              |

Many `crm-tools` subcommands support `--batch` for parallel describe/discover-style workloads.

---

## 9. Template system

- **Location:** `core/templates/` (+ partials), registered via `template-registry.json` and `shared.json` `template_files` where applicable.
- **Model:** prompts produce **structured slot JSON**; `template-tools` renders **Nunjucks** HTML for ADO fields; `wiki-engine-tools` renders **block-based** wiki specs.
- **Authoring guides:** e.g. `core/templates/*-templates.md`.

---

## 10. Standards layout

| Area                                    | Path                       | Contents                                                                                                                                                                                               |
| --------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Org-wide                                | `shared/standards/`        | `share-core.md`, **architecture.md** (this file), **`refinement-standards.md`** (functional vs technical + grooming rules), `organization-dictionary.json`, CRM/platform narrative standards as needed |
| Core engineering guides                 | `core/standards/`          | e.g. `wiki-section-content-guide.md`; ticket refinement rules live in **`shared/standards/refinement-standards.md`**                                                                                   |
| CRM depth                               | `platforms/crm/standards/` | Salesforce data, naming, architecture conventions                                                                                                                                                      |
| Human-readable work item & defect rules | `shared/standards/`        | `refinement-standards.md`, `defect-standards.md`                                                                                                                                                       |

Prompts reference standards via `#file:` with **repo-root-relative** paths. No central registry in `shared.json` for every markdown standard — discovery is by convention and explicit references.

---

## 11. Artifacts & audit

```
core/.ai-artifacts/
├── <work_item_id>/
│   └── ticket-context.json
├── reports/                    # CSV exports when used
└── audit/                      # optional structured audit log (design §14.1)
```

All under `core/.ai-artifacts/` are **gitignored** and ephemeral. Feature research may use additional subtrees per CRM prompts.

---

## 12. Extension guide

| Change                  | Steps                                                                                                                                                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **New utility prompt**  | Add `.github/prompts/core/util-<name>.prompt.md` (or shared/platforms) · wire into `util-help` / `copilot-instructions` when user-facing                                                                             |
| **New CLI command**     | Implement in `core/scripts/workflow/cli/<tool>-tools.ts` + `src/` · add `cli_commands` entry in `shared.json` · rebuild                                                                                              |
| **New platform**        | Add `platforms/<domain>/platform.json` (+ config/knowledge/standards/templates) · add prefixed **agents** if needed · prompts/skills under `.github/.../platforms/<domain>/` · tool suite when ready **(PRD: MP-3)** |
| **New template**        | Add HTML + registry · reference in `template_files` if ADO-linked                                                                                                                                                    |
| **New standard**        | Add markdown/json under correct pillar; reference from prompts with `#file:`                                                                                                                                         |
| **Config shape change** | Edit `shared.json` + types/loaders; bump `version`                                                                                                                                                                   |

Legacy **per-phase ticket prompts** are retired; extend behavior via the **unified** workflow or focused **util** prompts unless you intentionally fork a specialty pipeline (e.g. CRM feature research phases under `.github/prompts/platforms/crm/`).

---

## 13. Conventions

### Naming

| Kind                | Pattern                                                                         |
| ------------------- | ------------------------------------------------------------------------------- |
| Utility prompts     | `util-<name>.prompt.md`                                                         |
| Workflow entry      | `workflow-initial-copilot-grooming.prompt.md`, `feature-research-phase-*` (CRM) |
| Agents              | `<prefix>-<role>.agent.md`, flat folder                                         |
| Skills              | `<slug>/SKILL.md` under core/shared/platforms                                   |
| Field templates     | `field-<type>-<field>.html`                                                     |
| Knowledge (product) | `meridian-prd.md`, `meridian-solution-design.md`, kebab-case share docs         |

### Guardrails (summary)

1. Human review for anything that ships to production narratives **(SG-1)**.
2. Respect `core/safeguards.json` for autonomous prohibition **(SG-2)**.
3. Platform credentials isolated **(SG-4)** — no cross-wiring auth.
4. Prefer `--json` on CLI from automations for stable parsing.

### Research quality

Where prompts define research loops (contradictions, evidence gaps, …), follow the iteration caps and prioritization in `share-core.md` / domain share blocks.

---

## 14. Related files

- [`core/knowledge/tool-reference.md`](../../core/knowledge/tool-reference.md) — concise tool oriented notes
- [`core/knowledge/share-ado.md`](../../core/knowledge/share-ado.md) — ADO + context operations
- Root [`README.md`](../../README.md) — engineer onboarding and CLI quick reference

When this document and the solution design diverge, **trust `meridian-solution-design.md` for structural contract** and update this summary after large migrations.
