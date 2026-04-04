import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

/**
 * Migration 020: Rewrite all provider references to "copilot" in projection tables.
 *
 * Meridian Code is now Copilot-only. This migration canonicalizes provider
 * references in the projection/read-model tables that are decoded at startup.
 *
 * Checks both table and column existence to handle databases at different schema versions.
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const columnExists = (table: string, column: string) =>
    sql`SELECT COUNT(*) as cnt FROM pragma_table_info(${table}) WHERE name = ${column}`.pipe(
      Effect.map((rows) => {
        const row = rows[0] as { cnt: number } | undefined;
        return (row?.cnt ?? 0) > 0;
      }),
    );

  // ── projection_projects: default_model_selection_json ──────────────
  if (yield* columnExists("projection_projects", "default_model_selection_json")) {
    yield* sql`
      UPDATE projection_projects
      SET default_model_selection_json = json_replace(
        default_model_selection_json,
        '$.provider', 'copilot'
      )
      WHERE default_model_selection_json IS NOT NULL
        AND json_extract(default_model_selection_json, '$.provider') != 'copilot'
    `;
  }

  // ── projection_threads: model_selection_json ──────────────────────
  if (yield* columnExists("projection_threads", "model_selection_json")) {
    yield* sql`
      UPDATE projection_threads
      SET model_selection_json = json_replace(
        model_selection_json,
        '$.provider', 'copilot'
      )
      WHERE model_selection_json IS NOT NULL
        AND json_extract(model_selection_json, '$.provider') != 'copilot'
    `;
  }

  // ── projection_turns: model_selection_json ─────────────────────────
  if (yield* columnExists("projection_turns", "model_selection_json")) {
    yield* sql`
      UPDATE projection_turns
      SET model_selection_json = json_replace(
        model_selection_json,
        '$.provider', 'copilot'
      )
      WHERE model_selection_json IS NOT NULL
        AND json_extract(model_selection_json, '$.provider') != 'copilot'
    `;
  }

  // ── provider_sessions: provider_name ──────────────────────────────
  if (yield* columnExists("provider_sessions", "provider_name")) {
    yield* sql`
      UPDATE provider_sessions
      SET provider_name = 'copilot'
      WHERE provider_name != 'copilot'
    `;
  }
});
