# Util – Repeat Phase

> **Meridian:** Active — GitHub Copilot custom prompt (/.github/prompts/).

Mission: Re-run a specific workflow phase after updates or corrections.
Config: `#file:shared/standards/share-core.md` · `#file:core/knowledge/share-ado.md`
Input: `{{work_item_id}}` · `{{phase}}` (research | grooming | solutioning-research | solutioning | finalization)

## Step 1 [CLI] – Reset

`{{cli.workflow_reset}} -w {{work_item_id}} --phase {{phase}} --force --json`

## Step 2 – Re-run forward from checkpoint

After reset, run **`/workflow-initial-copilot-grooming`** with the same `{{work_item_id}}`. The unified workflow reads `ticket-context.json`, resumes from the appropriate concern, and re-executes from the phase you cleared through Publish.

Note: Concerns still update `ticket-context.json` directly. No separate artifacts per phase.
