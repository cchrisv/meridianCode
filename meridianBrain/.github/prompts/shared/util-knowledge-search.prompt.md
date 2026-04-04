# Util – Knowledge search

> **Meridian:** Active — GitHub Copilot custom prompt (/.github/prompts/).

Mission: Answer from Meridian knowledge graph using CLI search.
Config: `#file:core/config/shared.json`

Run: `npx --prefix core/scripts/workflow knowledge-tools search "<user question keywords>" --json`

Synthesize an answer from the `hits` array; cite file paths.
