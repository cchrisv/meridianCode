# Meridian Code

A ticket-centric AI coding assistant for platform engineering teams. Built on [t3 Code](https://github.com/pingdotgg/t3code) with [GitHub Copilot](https://github.com/features/copilot) as the AI provider.

Meridian Code brings together structured ticket workflows, a knowledge management system, and AI-powered grooming into a single desktop app where engineers never leave their IDE.

## What It Does

- **Ticket Lifecycle** --- Import ADO work items and guide them through a 6-stage process (Copilot Refinement, Triage, Refinement, Development, QA, Release)
- **AI-Powered Grooming** --- 5-phase autonomous workflow: Research, Groom, Solutioning Research, Solutioning Design, Finalization
- **Knowledge Management** --- Bundled `meridianBrain/` repository with platform configs, standards, templates, and organizational knowledge
- **CLI Tool Suite** --- 14 CLI tools (60+ commands) for ADO, Salesforce, wiki, templates, and reporting --- exposed to Copilot as callable tools
- **Multi-Platform** --- CRM (Salesforce), Marketing Automation (SFMC), Contact Center (Five9), Portal --- with extensible platform architecture

## Architecture

```
meridianCode/
  apps/
    desktop/     Electron desktop app
    server/      WebSocket server + CLI (Effect-based)
    web/         React 19 + Vite frontend
  packages/
    contracts/   Effect/Schema type contracts (no runtime)
    shared/      Shared runtime utilities
  meridianBrain/ Bundled knowledge repository
    .github/     Copilot instructions, agents, prompts, skills
    core/        Config, CLI scripts, templates, standards, knowledge
    shared/      Cross-platform knowledge and standards
    platforms/   Platform-specific configs (CRM, SFMC, Five9, Portal)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 22+ / Bun 1.3+ |
| Framework | [Effect](https://effect.website) 4.0 (services, layers, schemas) |
| AI Provider | GitHub Copilot SDK (`@github/copilot-sdk`) |
| Frontend | React 19, Vite 8, TanStack Router/Query, Zustand, Tailwind CSS 4 |
| Desktop | Electron 40 with auto-update |
| Testing | Vitest 4 |
| Linting | oxlint + oxfmt |

## Prerequisites

- [GitHub Copilot](https://github.com/features/copilot) subscription (Individual, Business, or Enterprise)
- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) (`az`) --- for ADO integration
- [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) (`sf`) --- for CRM platform features
- Node.js 22+ and Bun 1.3+

## Getting Started

### Desktop App

Install from [GitHub Releases](https://github.com/cchrisv/meridianCode/releases).

### Development

```bash
# Install dependencies
bun install

# Start dev servers (API + Web)
bun run dev

# Or start individually
bun run dev:server   # API/WebSocket on :3773
bun run dev:web      # Vite frontend on :5733

# Desktop with hot reload
bun run dev:desktop
```

### Build

```bash
bun run build              # Full build
bun run build:desktop      # Desktop app
bun run typecheck           # TypeScript check
bun run test               # Run all tests
bun run lint               # oxlint
bun run fmt                # oxfmt
```

## Meridian Brain

The `meridianBrain/` directory is a bundled knowledge repository that ships with the app. It contains:

- **Agents** --- AI personas (Solution Architect, Product Owner, CRM Specialist, etc.)
- **Prompts** --- 20+ structured utility prompts for grooming, solutioning, reporting, and more
- **Skills** --- Multi-step Copilot skills (ticket grooming, knowledge management, impact analysis)
- **CLI Tools** --- 14 TypeScript CLI suites wrapping ADO, Salesforce, wiki, and template operations
- **Platform Configs** --- Detection rules, standards, and knowledge per platform
- **Templates** --- HTML/Markdown templates for ADO fields, wiki pages, and reports

## CLI Tools (registered as Copilot SDK tools)

| Tool | Purpose |
|------|---------|
| `ado-tools` | ADO work items, backlog, links, iterations |
| `crm-tools` | Salesforce SOQL, metadata, dependency discovery |
| `workflow-tools` | Ticket context lifecycle (prepare, status, reset) |
| `pr-tools` | Pull request analysis, diffs, threads |
| `template-tools` | Template scaffolding and rendering |
| `wiki-tools` | ADO wiki CRUD and search |
| `wiki-engine-tools` | Wiki block rendering engine |
| `report-tools` | Activity reports for standups and 1:1s |
| `team-tools` | Team member discovery |
| `knowledge-tools` | Knowledge base search |
| `integration-tools` | Integration registry tracking |

## Project Status

**Alpha** --- Active development. Core infrastructure is stable. Building toward a full ticket-centric workflow experience.

| Phase | Status |
|-------|--------|
| Copilot-only provider | Done |
| CLI tools bridge (18 defineTool registrations) | Done |
| Ticket foundation (contracts, services, UI) | Done |
| Phase workflow + utility actions | Next |
| Knowledge CRUD + extraction | Planned |
| Reporting + polish | Planned |

## License

MIT
