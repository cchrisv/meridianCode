import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveBundledMeridianBrainPath } from "../../knowledge/bundledMeridianBrainPath";

/**
 * Manages ticket-context.json files in the Meridian Brain artifacts directory.
 *
 * Artifacts location: `{brainPath}/core/.ai-artifacts/{workItemId}/ticket-context.json`
 */
export class TicketArtifactStore {
  private readonly artifactsRoot: string;

  constructor() {
    const brainPath = resolveBundledMeridianBrainPath();
    this.artifactsRoot = join(brainPath, "core", ".ai-artifacts");
  }

  /** Get the path to a ticket's artifacts directory. */
  getTicketDir(workItemId: string): string {
    return join(this.artifactsRoot, workItemId);
  }

  /** Get the path to a ticket's context file. */
  getContextPath(workItemId: string): string {
    return join(this.getTicketDir(workItemId), "ticket-context.json");
  }

  /** Read and parse a ticket-context.json. Returns null if not found. */
  readContext(workItemId: string): unknown | null {
    const contextPath = this.getContextPath(workItemId);
    if (!existsSync(contextPath)) return null;
    try {
      const content = readFileSync(contextPath, "utf-8");
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /** Write ticket-context.json. Creates the directory if needed. */
  writeContext(workItemId: string, context: unknown): void {
    const dir = this.getTicketDir(workItemId);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.getContextPath(workItemId), JSON.stringify(context, null, 2), "utf-8");
  }

  /** List all work item IDs that have ticket-context.json files. */
  listWorkItemIds(): string[] {
    if (!existsSync(this.artifactsRoot)) return [];
    try {
      return readdirSync(this.artifactsRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((id) => existsSync(this.getContextPath(id)));
    } catch {
      return [];
    }
  }

  /** Extract basic metadata from a ticket-context.json for the list view. */
  extractMetadataFromContext(
    workItemId: string,
    context: Record<string, unknown>,
  ): {
    title: string;
    workItemType: string | undefined;
    platform: string | undefined;
    currentPhase: string | undefined;
    phasesCompleted: string[];
  } {
    const metadata = context.metadata as Record<string, unknown> | undefined;
    return {
      title: (metadata?.title as string) ?? `Work Item ${workItemId}`,
      workItemType: metadata?.work_item_type as string | undefined,
      platform: metadata?.platform as string | undefined,
      currentPhase: metadata?.current_phase as string | undefined,
      phasesCompleted: (metadata?.phases_completed as string[]) ?? [],
    };
  }
}
