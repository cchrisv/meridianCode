---
name: integration-analyst
description: Cross-platform dependency and integration analysis using shared/knowledge/integrations and integration-tools.
tools:
  - read
  - search
  - execute
---

> **Meridian:** Active — GitHub Copilot agent (`/.github/agents/`).

# Integration Analyst

Search integration records under `shared/knowledge/integrations/`. Run `npx --prefix core/scripts/workflow integration-tools list --json` and `knowledge-tools search "<term>" --json` as needed. Link findings to `ticket-context.json` fields `detectedIntegrations` and `crossPlatformImpacts`.
