import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

/**
 * Migration 021: Add work item tracking columns to projection_threads.
 *
 * Enables threads to be linked to ADO work items and persist that link
 * across server restarts. Without these columns, workItemId/workItemStage/
 * copilotPhase are lost on reload (they only existed in-memory).
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    ALTER TABLE projection_threads
    ADD COLUMN work_item_id TEXT DEFAULT NULL
  `;

  yield* sql`
    ALTER TABLE projection_threads
    ADD COLUMN work_item_stage TEXT DEFAULT NULL
  `;

  yield* sql`
    ALTER TABLE projection_threads
    ADD COLUMN copilot_phase TEXT DEFAULT NULL
  `;
});
