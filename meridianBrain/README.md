# Meridian — Platform Engineering Company OS

> **Meridian:** Active repo root — primary engineer entry (`util-help`, `util-setup`, `core/config/shared.json`).

**Meridian** is the operating system for Platform Engineering: an IDE-native, AI-assisted workflow framework that unifies how teams **research**, **groom**, and **deliver** work across CRM, marketing automation, contact center, portal, and the broader enterprise stack. Engineers stay in the editor; prompts, skills, and CLI tools orchestrate Azure DevOps, platform APIs, wikis, and templates.

**Product definition:** [Meridian PRD v1.0](core/knowledge/meridian-prd.md) (draft). **Implementation architecture:** [Meridian solution design](core/knowledge/meridian-solution-design.md).

> **Vision:** Any platform engineer can pick up a ticket on any supported platform and get the context they need within minutes — because Meridian captures institutional knowledge and surfaces cross-platform dependencies instead of leaving them in people’s heads.

---

## What Meridian delivers

These outcomes map directly to the PRD (Sections 3–5):

| Pillar                                | Intent                                                                                                                                                                            |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Unified workflow**                  | The same phased lifecycle and `ticket-context.json` pattern apply whether the work is CRM, another platform pillar, or cross-cutting (**MP-1**).                                  |
| **Platform depth without core forks** | Each domain extends the system via `platforms/<name>/` (manifests, standards, tools, prompts) without rewriting the core (**MP-2**, **MP-3**).                                    |
| **Living knowledge**                  | Knowledge is organized under `core/knowledge`, `shared/knowledge`, and platform trees; integrations are registered under `shared/knowledge/integrations/` (**KC-\***, **CV-\***). |
| **IDE-first experience**              | Primary interface is the repo plus Copilot/Cursor — no separate product UI required (**AX-1**).                                                                                   |
| **Governance**                        | Safeguards and audit hooks live under `core/` (e.g. `core/safeguards.json`, `core/.ai-artifacts/audit/`) so boundaries are explicit (**SG-\***).                                  |

**Today’s maturity:** The **CRM (Salesforce)** path is the most complete (full CLI suite, agents, prompts). **Marketing automation**, **contact center**, and **portal** pillars are scaffolded (`platform.json`, prompts, skills, stub CLIs) so Phase 1 rollout can deepen them without restructuring the repo again.

---

## Quick start

1. Open this repository root in your IDE (must contain `core/config/shared.json`).
2. In chat, run:

   ```
   /util-setup
   ```

   This walks through prerequisites, `core/scripts/workflow` dependencies, Azure DevOps (Azure CLI) and Salesforce (SF CLI) auth, and sanity checks.

3. Work a ticket end-to-end in **one** workflow:

   ```
   /workflow-initial-copilot-grooming
   ```

   Provide an Azure DevOps work item ID, Salesforce object API names, or both — depth and outputs adapt automatically (grooming, solution design, WSJF, wiki when needed).

4. For a catalog of utilities and concepts:

   ```
   /util-help
   ```

---

## Optional wiki guides

- [GitHub Copilot Azure DevOps Setup Guide](https://dev.azure.com/UMGC/Digital%20Platforms/_wiki/wikis/Digital%20Platforms%20Wiki/8714/GitHub-Copilot-Azure-DevOps-Setup-Guide-for-Salesforce-Team)
- [Working Your First Salesforce Ticket with GitHub Copilot](https://dev.azure.com/UMGC/Digital%20Platforms/_wiki/wikis/Digital%20Platforms%20Wiki/10590/Working-Your-First-Salesforce-Ticket-with-GitHub-Copilot)

---

## How it works

### Unified context

Each work item gets a single **`core/.ai-artifacts/<work_item_id>/ticket-context.json`**. Phases (or unified workflow concerns) append research, grooming, solutioning, and finalization so later steps build on earlier decisions. After development, **`/util-dev-trueup`** reconciles planned vs actual.

### Concerns vs granular phases

The primary entry point is the **unified grooming workflow** (`/workflow-initial-copilot-grooming`), structured as **Discover → Refine → Solve → Size → Publish**.

Use the **feature research** pipeline for deep Salesforce current-state documentation (separate from the ticket lifecycle):

| Mode                      | Entry                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------- |
| Ticket lifecycle          | `/workflow-initial-copilot-grooming`                                                  |
| Redo one context section  | `/util-repeat-phase` (then run the unified workflow again with the same work item ID) |
| Feature / object research | `feature-research-phase-01-initialize` … `feature-research-phase-05-documentation`    |

---

## Repository layout

```
.github/                          # Copilot surface (paths fixed by GitHub)
├── copilot-instructions.md
├── prompts/core|shared|platforms/
├── agents/                       # flat *.agent.md only
└── skills/

core/                             # Engine: config, CLI, templates, safeguards, system knowledge
├── config/shared.json            # paths, CLI templates, ADO defaults
├── config/local.json.example     # optional local overrides template → copy to local.json (gitignore)
├── scripts/workflow/             # npm run build / test
├── templates/                    # Nunjucks + template-registry.json
├── knowledge/
├── standards/                    # core ADO-oriented standards (see shared.json paths)
└── safeguards.json

shared/                           # Org-wide standards + knowledge graph roots
├── standards/
├── knowledge/                    # eight-domain knowledge layout + integrations/
└── config/

platforms/<name>/                 # crm, marketing-automation, contact-center, portal, …
├── platform.json
├── config/                       # e.g. crm-orgs.json (typically gitignored)
├── knowledge/ | standards/ | templates/

core/.ai-artifacts/               # runtime ticket + audit output (gitignored)
```

---

## Prompts and agents

### Utility prompts (high use)

| Area               | Examples                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Ticket / delivery  | `util-dev-trueup`, `util-grooming-update`, `util-solutioning-update`, `util-pr-analysis`, `util-refinement-review` |
| ADO / backlog      | `util-backlog-view`, `util-backlog-reorder`, `util-backlog-validate`, `util-sequence-tickets`                      |
| Wiki / templates   | `util-wiki-create`, `util-wiki-update`, `util-apply-template`                                                      |
| People / reporting | `util-team-members`, `util-activity-report`, `util-morning-checkin`                                                |
| System             | `util-setup`, `util-help`, `util-sync`, `util-feedback`, `util-repeat-phase`                                       |

See **`/util-help`** for the full list and how prompts connect.

### Agents (conversational)

Flat definitions under **`.github/agents/`**:

| Agent                                                                                          | Role                                          |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `solution-architect`, `product-owner`, `integration-analyst`                                   | Cross-platform                                |
| `crm-solution-architect`, `crm-product-owner`                                                  | Salesforce depth                              |
| `marketing-automation-journey-architect`, `contact-center-ivr-specialist`, `portal-specialist` | Platform specialists (extend as tools mature) |

---

## CLI tools

Invocations:

```bash
npx --prefix core/scripts/workflow <tool> <command> [options] --json
```

Most commands accept `--json` and `-v`.

### Quick reference

```bash
npx --prefix core/scripts/workflow workflow-tools prepare -w <id> --json
npx --prefix core/scripts/workflow ado-tools get <id> --comments --json
npx --prefix core/scripts/workflow crm-tools query "<SOQL>" --org <alias> --json
npx --prefix core/scripts/workflow knowledge-tools search "<query>" --json
npx --prefix core/scripts/workflow integration-tools list --json
npx --prefix core/scripts/workflow wiki-tools search "<term>" --json
npx --prefix core/scripts/workflow pr-tools get --url <fullPrUrl> --json
npx --prefix core/scripts/workflow template-tools list --phase <phase> --type "User Story" --json
```

### workflow-tools

Prepare, status, and reset ticket context:

```bash
npx --prefix core/scripts/workflow workflow-tools prepare -w <id> [--force] --json
npx --prefix core/scripts/workflow workflow-tools status -w <id> --json
npx --prefix core/scripts/workflow workflow-tools reset -w <id> --phase <phase> --force --json
```

Phases include: `research`, `grooming`, `solutioning`, `finalization`, `dev_updates`, `closeout`.

### ado-tools

Read/write work items, search, backlog ordering, links, iterations. Example:

```bash
npx --prefix core/scripts/workflow ado-tools get <id> --comments --json
npx --prefix core/scripts/workflow ado-tools backlog --area-path "<Area Path>" --top 25 --json
```

Use your org’s area paths (see `core/config/shared.json` → `ado_defaults.area_paths` for examples).

### crm-tools (Salesforce)

Org resolution uses **`platforms/crm/config/crm-orgs.json`** (see **`platforms/crm/config/crm-orgs.example.json`**). Roles include `primary`, `legacy`, `modern`, `legacyData`, `legacyMetadata`, `modernData`, `modernMetadata`, `dataCloud`.

```bash
npx --prefix core/scripts/workflow crm-tools org-setup
npx --prefix core/scripts/workflow crm-tools query "<SOQL>" [--role <role>] [--org <alias>] --json
npx --prefix core/scripts/workflow crm-tools describe <ObjectApiName> [--role <role>] --json
```

### template-tools

Templates live under **`core/templates/`** (registry: **`core/templates/template-registry.json`**), with shared partials alongside them.

```bash
npx --prefix core/scripts/workflow template-tools list --phase <phase> --type "User Story" --json
npx --prefix core/scripts/workflow template-tools scaffold-phase --phase <phase> --type "User Story" -w <id> --json
npx --prefix core/scripts/workflow template-tools render-phase --phase <phase> -w <id> --context <file> --json
```

### Other suites

- **wiki-tools** — ADO wiki CRUD, search, attachments
- **pr-tools** — PR metadata, diff, threads, linked work items
- **report-tools** — activity CSV reports
- **team-tools** — Microsoft Graph org discovery
- **wiki-engine-tools** — block-based wiki composition

---

## Authentication

### Azure DevOps

```bash
az login
az account show
```

### Salesforce

```bash
sf org login web -a <alias>
npx --prefix core/scripts/workflow crm-tools org-setup
```

Platform-scoped credentials stay isolated per manifest (**SG-4**). For optional machine-local overrides, see **`core/config/local.json.example`** and the solution design (§11–12).

---

## Configuration

Single source of truth: **`core/config/shared.json`**.

- **Paths** — `paths.artifacts_root`, `paths.templates`, `paths.knowledge.*`, `paths.standards.*`, `paths.platforms`
- **CLI fragments** — e.g. `cli_commands.ado_get`, `cli_commands.sf_query`; prompts should use template variables (e.g. `{{cli.ado_get}}`) not hardcoded strings
- **ADO defaults** — organization, project, wiki, feedback parent work item, area path hints

Changing a path or command prefix here updates every consumer that respects the template system.

---

## Development

```bash
cd core/scripts/workflow
npm install
npm run build
npm test
npm run lint
```

---

## Further reading

| Document                                                                                                                                           | Purpose                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [core/knowledge/](core/knowledge/)                                                                                                                 | System knowledge (PRD, solution design, share-\* guides for prompts) |
| [core/knowledge/meridian-prd.md](core/knowledge/meridian-prd.md)                                                                                   | Vision, requirements (MP/KC/CV/SI/AX/SG), phased rollout             |
| [core/knowledge/meridian-solution-design.md](core/knowledge/meridian-solution-design.md)                                                           | Repo layout, Copilot primitives, migration and validation            |
| [shared/standards/refinement-standards.md](shared/standards/refinement-standards.md) · [defect-standards.md](shared/standards/defect-standards.md) | Work items & defects / bugs                                          |
| [core/config/shared.json](core/config/shared.json)                                                                                                 | Paths and CLI command map                                            |
| [.github/copilot-instructions.md](.github/copilot-instructions.md)                                                                                 | Global Copilot rules                                                 |
| [shared/standards/organization-dictionary.json](shared/standards/organization-dictionary.json)                                                     | Org terminology for research prompts                                 |
| [docs/README.md](docs/README.md)                                                                                                                   | Index of product docs, standards, brand, decks                       |
