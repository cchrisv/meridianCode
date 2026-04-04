---
name: ticket-grooming
description: Orchestrates the five-phase Meridian ticket lifecycle. Invokes when the user is working an ADO item with workflow context.
allowed-tools:
  - bash
metadata:
  author: Platform Engineering
  version: 1.0
---

> **Meridian:** Active — GitHub Copilot skill (`/.github/skills/`).

# Ticket grooming

Use `/workflow-initial-copilot-grooming` for the full ticket lifecycle (Discover → Publish). Run `workflow-tools prepare` first when starting cold. Respect `core/safeguards.json`. To redo one phase only, use `/util-repeat-phase`.
