import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { resolveBundledMeridianBrainPath } from "../../knowledge/bundledMeridianBrainPath";
import type { TicketStage } from "@t3tools/contracts";

// ── Types ────────────────────────────────────────────────────────────

export interface PromptDefinition {
  /** Prompt file name without extension (e.g., "util-grooming-update") */
  readonly name: string;
  /** Human-readable label */
  readonly label: string;
  /** Short description */
  readonly description: string;
  /** Which stages this prompt is relevant for */
  readonly stages: readonly TicketStage[] | "any";
  /** Input variables the prompt expects (e.g., ["work_item_id", "context_file"]) */
  readonly variables: readonly string[];
  /** Relative path to the prompt file */
  readonly path: string;
}

export interface LoadedPrompt {
  readonly name: string;
  readonly content: string;
  /** Variables that were injected */
  readonly injectedVariables: Record<string, string>;
}

// ── Stage → Action mapping ───────────────────────────────────────────

const STAGE_PROMPT_MAP: Record<string, readonly string[]> = {
  "copilot-refinement": [
    "workflow-initial-copilot-grooming",
    "util-repeat-phase",
  ],
  "triage": [],
  "refinement": [
    "util-refinement-review",
    "util-grooming-update",
  ],
  "development": [
    "util-solutioning-update",
    "util-pr-analysis",
    "util-dev-trueup",
  ],
  "qa": [],
  "release": [],
};

/** Prompts available at any stage */
const UNIVERSAL_PROMPTS = [
  "util-morning-checkin",
  "util-activity-report",
  "util-activity-briefing",
  "util-groom-feature",
  "util-feature-solution-design",
  "util-update-feature-progress",
  "util-sequence-tickets",
  "util-help",
  "util-backlog-view",
];

// ── Prompt metadata ──────────────────────────────────────────────────

const PROMPT_LABELS: Record<string, { label: string; description: string }> = {
  "workflow-initial-copilot-grooming": {
    label: "Run Full Grooming",
    description: "Run the 5-phase AI grooming workflow (Research, Groom, Solve, Design, Finalize)",
  },
  "util-repeat-phase": {
    label: "Repeat Phase",
    description: "Re-run a specific grooming phase with new information",
  },
  "util-grooming-update": {
    label: "Update Grooming",
    description: "Update Description & ACs when requirements change mid-development",
  },
  "util-solutioning-update": {
    label: "Update Solutioning",
    description: "Re-render Development Summary when technical approach changes",
  },
  "util-refinement-review": {
    label: "Refinement Review",
    description: "Requirements quality audit (INVEST, OCM, anti-patterns)",
  },
  "util-pr-analysis": {
    label: "PR Analysis",
    description: "Code quality & standards review against requirements",
  },
  "util-dev-trueup": {
    label: "Dev True-Up",
    description: "Reconcile planned vs actual, generate release notes",
  },
  "util-morning-checkin": {
    label: "Morning Check-in",
    description: "Generate daily standup content with overlap detection",
  },
  "util-activity-report": {
    label: "Activity Report",
    description: "1:1 prep report (narrative format, coaching tone)",
  },
  "util-activity-briefing": {
    label: "Activity Briefing",
    description: "Manager strategic overview (5 key questions)",
  },
  "util-groom-feature": {
    label: "Groom Feature",
    description: "Refine Feature description & fields from child stories",
  },
  "util-feature-solution-design": {
    label: "Feature Solution Design",
    description: "Aggregated solution architecture + wiki documentation",
  },
  "util-update-feature-progress": {
    label: "Update Feature Progress",
    description: "Health check, completion %, status narratives",
  },
  "util-sequence-tickets": {
    label: "Sequence Tickets",
    description: "Dependency analysis and execution order planning",
  },
  "util-help": {
    label: "Help",
    description: "Workflow guide, prompt reference, and decision tree",
  },
  "util-backlog-view": {
    label: "View Backlog",
    description: "Read-only snapshot of the backlog in priority order",
  },
};

// ── Core functions ───────────────────────────────────────────────────

/** Detect {{variable}} patterns in prompt content. */
function detectVariables(content: string): string[] {
  const matches = content.match(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g) ?? [];
  const unique = [...new Set(matches.map((m) => m.slice(2, -2)))];
  return unique;
}

/** List all available prompts. Always returns all prompts (no stage filtering). */
export function listPrompts(_stage?: TicketStage): PromptDefinition[] {
  const brainPath = resolveBundledMeridianBrainPath();
  const promptsDir = join(brainPath, ".github", "prompts", "core");

  if (!existsSync(promptsDir)) return [];

  const files = readdirSync(promptsDir).filter((f) => f.endsWith(".prompt.md"));
  const definitions: PromptDefinition[] = [];

  for (const file of files) {
    const name = basename(file, ".prompt.md");
    const meta = PROMPT_LABELS[name];
    if (!meta) continue; // Skip prompts without metadata

    // Detect variables from file content
    const filePath = join(promptsDir, file);
    const content = readFileSync(filePath, "utf-8");
    const variables = detectVariables(content);
    const stages: readonly TicketStage[] | "any" = "any";

    definitions.push({
      name,
      label: meta.label,
      description: meta.description,
      stages,
      variables,
      path: `.github/prompts/core/${file}`,
    });
  }

  return definitions;
}

/** Load a prompt by name and inject variables from ticket context. */
export function loadPrompt(
  promptName: string,
  variables: Record<string, string> = {},
): LoadedPrompt {
  const brainPath = resolveBundledMeridianBrainPath();
  const filePath = join(brainPath, ".github", "prompts", "core", `${promptName}.prompt.md`);

  if (!existsSync(filePath)) {
    throw new Error(`Prompt not found: ${promptName}`);
  }

  let content = readFileSync(filePath, "utf-8");
  const injected: Record<string, string> = {};

  // Inject variables
  for (const [key, value] of Object.entries(variables)) {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    if (pattern.test(content)) {
      content = content.replace(pattern, value);
      injected[key] = value;
    }
  }

  return {
    name: promptName,
    content,
    injectedVariables: injected,
  };
}
