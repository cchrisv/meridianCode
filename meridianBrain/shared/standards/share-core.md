# Share – Core

> **Meridian:** Active — Copilot `#file:shared/standards/share-core.md` on nearly all utilities and grooming.

Platform-agnostic patterns used by ALL prompts regardless of domain.
NEVER references ADO, Salesforce, wiki, or any platform concept.

## Core Guardrails

1. **CLI-only** – use CLI commands; NEVER raw shell (curl, az, git, npm)
2. **No hardcoded paths** – use template variables; NEVER absolute paths
3. **Config read-only** – NEVER modify shared.json or CLI scripts unless asked
4. **Load config first** – always load shared.json before execution
5. **No assumed inputs** – If `{{work_item_id}}` was not explicitly provided as a number in the user's message, use the interactive question tool to ask for it before taking any action. NEVER infer work item IDs from terminal output, prior context, editor state, open files, or ambient history.

## Step Types

`[IO]` file read/write · `[CLI]` tool execution · `[API]` remote API · `[LOGIC]` conditional · `[GEN]` AI reasoning

## CLI Error Recovery Protocol

When any CLI command fails:

1. Log the command, error code, and error message to `run_state.errors[]` (if context exists) or report inline
2. Classify the failure:
   - **Auth failure** (401/403/login required) → STOP. Instruct user to authenticate. For long-running phases: if auth failure occurs after ≥5 successful CLI calls in the same session, this is likely a token expiry, not a permissions issue. → Ask user to re-authenticate, then retry the failed step (not the whole phase).
   - **Not found** (404/item does not exist) → Log and skip. Continue to next step.
   - **Rate limit** (429/throttled) → Wait 30s, retry once.
   - **Transient** (500/502/503/timeout) → Retry once with 5s delay.
   - **Validation** (400/invalid input) → Log the error. Fix input if possible, otherwise STOP.
   - **Conflict** (409/already exists) → Log and continue (idempotent operations).
3. After max 1 retry: STOP the current step, log the failure, continue to next step if non-blocking.
4. At phase completion: enumerate all logged errors in the user summary.

## Context File Recovery

If `{{context_file}}` fails to parse:

1. Check for `.bak` file (`{{context_file}}.bak`) — if valid, restore from backup.
2. Check `run_state` for last known good checkpoint.
3. If unrecoverable: inform user, suggest `workflow-tools reset --phase <last_completed> --force`.

Before each write to `{{context_file}}`, copy current to `.bak` as insurance.

## Interactive Question Fallback

If the interactive question tool is unavailable or the user cannot respond:

1. For input collection: use sensible defaults where defined; log assumption.
2. For confirmation gates: present the same options as plain text and await response.
3. Never auto-proceed past a destructive operation gate without explicit confirmation.

## Batch Failure Threshold

When running batch operations:

1. If >50% of items in a batch fail → STOP the batch. Report failures.
2. If ≤50% fail → continue with successful items; log each failure individually.
3. If a failed item was critical input for a downstream step → mark that step as skipped.

## Graceful Degradation Protocol

When a non-critical data source is unavailable (missing context, failed query, empty results):

1. Log what's missing and why to `run_state.errors[]` (if context exists) or report inline.
2. Document which analysis sections will have reduced depth.
3. Continue with available data — never halt for non-blocking gaps.
4. In the final summary, list all degraded sections with the reason.
5. Never present degraded output as complete — always flag reduced confidence.

## Rolling Synthesis

After each stream:

1. Update `.research.synthesis.unified_truth`
2. Update `.research.assumptions[]` (ID, category, confidence, source)
3. Continue to next stream with cumulative context

## Feedback Loop Protocol

Triggers (max 3 iterations/stream):

- New Topic/Component → revisit
- Evidence Gap → fill
- Contradiction → resolve
- High-Impact → validate
- Missing Context → investigate

Log to `.research.synthesis.conflict_log[]`

## Stream Save Protocol

**MUST write to disk before starting next stream.**

1. `[IO]` Write `{{context_file}}`
2. `[GEN]` Update synthesis + assumptions
3. `[IO]` Append to `run_state.completed_steps[]`
4. `[IO]` Save to disk — **GATE: do not proceed until confirmed written**
5. On error: log to `run_state.errors[]`; save to disk; retry/continue

## Mission Anchor Protocol

Before each research stream, re-read the mission statement from the context to stay grounded in scope. If the current investigation drifts from the mission:

1. Log the drift observation.
2. Refocus on the original scope.
3. Note tangential findings as `out_of_scope_observations` for potential follow-up.
