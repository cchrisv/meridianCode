/**
 * Batch Reformat Workflow
 * Processes multiple work items through the reformat workflow
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const WORK_ITEM_IDS = [260337, 259652, 258293, 257406];
const ARTIFACTS_ROOT = "core/.ai-artifacts";

interface WorkItemResult {
  id: number;
  status: "success" | "failed";
  error?: string;
}

function executeCommand(command: string): string {
  try {
    return execSync(command, { encoding: "utf-8", stdio: "pipe" });
  } catch (error: any) {
    throw new Error(`Command failed: ${error.message}`);
  }
}

async function processWorkItem(id: number): Promise<WorkItemResult> {
  console.log(`\n${"=".repeat(50)}`);
  console.log(`Processing Work Item: ${id}`);
  console.log(`${"=".repeat(50)}\n`);

  try {
    // Create artifact directory
    const artifactDir = path.join(ARTIFACTS_ROOT, id.toString(), "reformat");
    if (!fs.existsSync(artifactDir)) {
      fs.mkdirSync(artifactDir, { recursive: true });
    }

    // Fetch work item
    console.log(`[${id}] Fetching work item...`);
    const wiData = executeCommand(
      `npx --prefix core/scripts/workflow ado-tools get ${id} --expand All --json`,
    );

    const wi = JSON.parse(wiData);

    if (wi.id !== id) {
      throw new Error(`ADO API returned wrong ID: expected ${id}, got ${wi.id}`);
    }

    const workItemType = wi.fields["System.WorkItemType"];
    const title = wi.fields["System.Title"];

    console.log(`[${id}] Type: ${workItemType}`);
    console.log(`[${id}] Title: ${title}`);

    // Only process User Stories
    if (workItemType !== "User Story") {
      throw new Error(`Unsupported work item type: ${workItemType}`);
    }

    // Extract fields
    const description = wi.fields["System.Description"] || "";
    const acceptanceCriteria = wi.fields["Microsoft.VSTS.Common.AcceptanceCriteria"] || "";

    if (!description && !acceptanceCriteria) {
      throw new Error("No content fields to reformat");
    }

    console.log(`[${id}] Content fields found - proceeding with reformat`);

    // TODO: Implement actual HTML parsing, reformatting, and template application
    // For now, this is a placeholder that marks the work item as successfully fetched

    // Save artifact
    fs.writeFileSync(path.join(artifactDir, "workitem-data.json"), JSON.stringify(wi, null, 2));

    console.log(`[${id}] ✓ Successfully processed`);

    return { id, status: "success" };
  } catch (error: any) {
    console.error(`[${id}] ✗ Error: ${error.message}`);
    return { id, status: "failed", error: error.message };
  }
}

async function main() {
  console.log("Batch Reformat Workflow");
  console.log(`Processing ${WORK_ITEM_IDS.length} work items\n`);

  const results: WorkItemResult[] = [];

  for (const id of WORK_ITEM_IDS) {
    const result = await processWorkItem(id);
    results.push(result);
  }

  // Summary
  console.log(`\n${"=".repeat(50)}`);
  console.log("SUMMARY");
  console.log(`${"=".repeat(50)}\n`);

  const successful = results.filter((r) => r.status === "success");
  const failed = results.filter((r) => r.status === "failed");

  console.log(`Total: ${results.length}`);
  console.log(`Successful: ${successful.length}`);
  console.log(`Failed: ${failed.length}\n`);

  if (failed.length > 0) {
    console.log("Failed IDs:");
    failed.forEach((r) => console.log(`  - ${r.id}: ${r.error}`));
  }

  if (successful.length > 0) {
    console.log("\nSuccessful IDs:");
    successful.forEach((r) => console.log(`  - ${r.id}`));
  }

  // Save summary
  fs.writeFileSync(
    path.join(ARTIFACTS_ROOT, "batch-reformat-summary.json"),
    JSON.stringify(results, null, 2),
  );

  console.log(`\nSummary saved to ${path.join(ARTIFACTS_ROOT, "batch-reformat-summary.json")}`);
}

main().catch(console.error);
