import type { Tool } from "@github/copilot-sdk";
import { runCliTool } from "./cliSpawner";

// ── JSON Schema helpers ──────────────────────────────────────────────
// The Copilot SDK accepts either Zod schemas or raw JSON schema objects.
// We use raw JSON schema objects to avoid adding a zod dependency.

const str = (description: string) => ({ type: "string" as const, description });
const strOpt = (description: string) => ({ type: "string" as const, description });
const bool = (description: string) => ({ type: "boolean" as const, description });
const strEnum = (values: readonly string[], description: string) => ({
  type: "string" as const,
  enum: values,
  description,
});

function params(
  required: Record<string, { type: string; description: string; enum?: readonly string[] }>,
  optional: Record<string, { type: string; description: string; enum?: readonly string[] }> = {},
): Record<string, unknown> {
  return {
    type: "object",
    properties: { ...required, ...optional },
    required: Object.keys(required),
    additionalProperties: false,
  };
}

// ── Tool factory ─────────────────────────────────────────────────────

function cliTool(
  name: string,
  description: string,
  tool: string,
  buildArgs: (args: Record<string, unknown>) => string[],
  schema?: Record<string, unknown>,
  options?: { timeout?: number },
): Tool<Record<string, unknown>> {
  return {
    name,
    description,
    ...(schema ? { parameters: schema } : {}),
    handler: async (args: Record<string, unknown>) => {
      const cliArgs = buildArgs(args);
      return runCliTool(tool, cliArgs, options?.timeout ? { timeout: options.timeout } : undefined);
    },
  };
}

// ── P0 Tool Definitions ──────────────────────────────────────────────

const adoTools: Tool<Record<string, unknown>>[] = [
  cliTool(
    "ado_get_work_item",
    "Get an Azure DevOps work item by ID. Returns full work item data including fields, relations, and history.",
    "ado-tools",
    (args) => {
      const cmd = ["get", String(args.id)];
      if (args.expand) cmd.push("-e", String(args.expand));
      return cmd;
    },
    params(
      { id: str("Work item ID (number)") },
      { expand: strEnum(["None", "Relations", "Fields", "Links", "All"], "Expand level") },
    ),
  ),

  cliTool(
    "ado_update_work_item",
    "Update fields on an Azure DevOps work item. Use for updating Description, Acceptance Criteria, Story Points, Priority, Tags, and other fields.",
    "ado-tools",
    (args) => {
      const cmd = ["update", String(args.id)];
      if (args.title) cmd.push("-t", String(args.title));
      if (args.description) cmd.push("-d", String(args.description));
      if (args.state) cmd.push("-s", String(args.state));
      if (args.assignedTo) cmd.push("-a", String(args.assignedTo));
      if (args.areaPath) cmd.push("--area-path", String(args.areaPath));
      if (args.iterationPath) cmd.push("--iteration-path", String(args.iterationPath));
      if (args.fields) cmd.push("--fields", String(args.fields));
      return cmd;
    },
    params(
      { id: str("Work item ID") },
      {
        title: strOpt("New title"),
        description: strOpt("New description (HTML)"),
        state: strOpt("New state"),
        assignedTo: strOpt("Assigned to email"),
        areaPath: strOpt("Area path"),
        iterationPath: strOpt("Iteration path"),
        fields: strOpt("JSON string of custom field updates"),
      },
    ),
  ),

  cliTool(
    "ado_search_work_items",
    "Search Azure DevOps work items by text. Returns matching work items with title, state, type, and assigned to.",
    "ado-tools",
    (args) => {
      const cmd = ["search"];
      if (args.text) cmd.push("-t", String(args.text));
      if (args.type) cmd.push("--type", String(args.type));
      if (args.state) cmd.push("--state", String(args.state));
      if (args.areaPath) cmd.push("--area-path", String(args.areaPath));
      return cmd;
    },
    params(
      { text: str("Search text") },
      {
        type: strOpt("Work item type filter"),
        state: strOpt("State filter"),
        areaPath: strOpt("Area path filter"),
      },
    ),
  ),

  cliTool(
    "ado_get_backlog",
    "List the backlog for an area path in priority order. Returns work items with position, title, type, state, and assignee.",
    "ado-tools",
    (args) => {
      const cmd = ["backlog", "--area-path", String(args.areaPath)];
      if (args.detail) cmd.push("--detail", String(args.detail));
      return cmd;
    },
    params(
      { areaPath: str("Area path (e.g., 'Project\\\\Team')") },
      { detail: strEnum(["light", "summary", "full"], "Detail level") },
    ),
  ),

  cliTool(
    "ado_link_work_items",
    "Create a link between two Azure DevOps work items (parent, child, related, predecessor, successor).",
    "ado-tools",
    (args) => ["link", String(args.sourceId), String(args.targetId), "--type", String(args.linkType)],
    params({
      sourceId: str("Source work item ID"),
      targetId: str("Target work item ID"),
      linkType: strEnum(["parent", "child", "related", "predecessor", "successor"], "Link type"),
    }),
  ),

  cliTool(
    "ado_get_relations",
    "Get all relations (links) for an Azure DevOps work item. Returns parent, children, related, and other linked items.",
    "ado-tools",
    (args) => {
      const cmd = ["relations", String(args.id)];
      if (args.type) cmd.push("--type", String(args.type));
      return cmd;
    },
    params(
      { id: str("Work item ID") },
      { type: strOpt("Filter by relation type (comma-separated)") },
    ),
  ),
];

const workflowTools: Tool<Record<string, unknown>>[] = [
  cliTool(
    "workflow_prepare",
    "Initialize workflow artifacts for a work item. Creates ticket-context.json with unified workflow structure. Run this before starting any grooming workflow.",
    "workflow-tools",
    (args) => {
      const cmd = ["prepare", "-w", String(args.workItemId)];
      if (args.force) cmd.push("--force");
      return cmd;
    },
    params(
      { workItemId: str("ADO work item ID") },
      { force: bool("Force re-initialization") },
    ),
  ),

  cliTool(
    "workflow_status",
    "Get the current workflow status for a work item. Shows current phase, completed phases, and populated context sections.",
    "workflow-tools",
    (args) => ["status", "-w", String(args.workItemId)],
    params({ workItemId: str("ADO work item ID") }),
  ),

  cliTool(
    "workflow_reset",
    "Reset workflow state for a work item. Can reset a specific phase or the entire context.",
    "workflow-tools",
    (args) => {
      const cmd = ["reset", "-w", String(args.workItemId)];
      if (args.phase) cmd.push("-p", String(args.phase));
      if (args.force) cmd.push("--force");
      return cmd;
    },
    params(
      { workItemId: str("ADO work item ID") },
      {
        phase: strEnum(
          ["research", "grooming", "solutioning", "solutioning_research", "test_cases", "wiki", "finalization", "dev_updates", "closeout"],
          "Phase to reset",
        ),
        force: bool("Skip confirmation"),
      },
    ),
  ),
];

const crmTools: Tool<Record<string, unknown>>[] = [
  cliTool(
    "crm_query",
    "Execute a SOQL query against a Salesforce org. Returns query results as JSON. Use for querying records, counts, and metadata.",
    "crm-tools",
    (args) => {
      const cmd = ["query", String(args.soql)];
      if (args.org) cmd.push("-o", String(args.org));
      if (args.role) cmd.push("-r", String(args.role));
      if (args.tooling) cmd.push("--tooling");
      if (args.all) cmd.push("--all");
      return cmd;
    },
    params(
      { soql: str("SOQL query string") },
      {
        org: strOpt("Org alias"),
        role: strOpt("Role (e.g., 'dev', 'admin')"),
        tooling: bool("Use Tooling API"),
        all: bool("Handle pagination automatically"),
      },
    ),
    { timeout: 120_000 },
  ),

  cliTool(
    "crm_describe",
    "Describe Salesforce objects. Returns field definitions, record types, relationships, and metadata for one or more SObjects.",
    "crm-tools",
    (args) => {
      const cmd = ["describe", String(args.objects)];
      if (args.field) cmd.push("-f", String(args.field));
      if (args.fieldsOnly) cmd.push("--fields-only");
      if (args.org) cmd.push("-o", String(args.org));
      if (args.role) cmd.push("-r", String(args.role));
      return cmd;
    },
    params(
      { objects: str("Comma-separated SObject names (e.g., 'Account,Contact')") },
      {
        field: strOpt("Filter to specific field name"),
        fieldsOnly: bool("Return only field definitions"),
        org: strOpt("Org alias"),
        role: strOpt("Role"),
      },
    ),
    { timeout: 120_000 },
  ),

  cliTool(
    "crm_discover",
    "Discover metadata dependencies for a Salesforce component. Maps relationships between objects, fields, classes, triggers, and flows.",
    "crm-tools",
    (args) => {
      const cmd = ["discover", "--type", String(args.type)];
      if (args.name) cmd.push("--name", String(args.name));
      if (args.org) cmd.push("-o", String(args.org));
      if (args.role) cmd.push("-r", String(args.role));
      return cmd;
    },
    params(
      { type: strEnum(["CustomObject", "CustomField", "ApexClass", "ApexTrigger", "Flow", "ValidationRule"], "Metadata type") },
      {
        name: strOpt("Component API name"),
        org: strOpt("Org alias"),
        role: strOpt("Role"),
      },
    ),
    { timeout: 180_000 },
  ),
];

const templateTools: Tool<Record<string, unknown>>[] = [
  cliTool(
    "template_scaffold",
    "Create a template scaffold from existing ticket context. Produces a template structure that can be filled and rendered.",
    "template-tools",
    (args) => {
      const cmd = ["scaffold"];
      if (args.context) cmd.push("-c", String(args.context));
      if (args.output) cmd.push("-o", String(args.output));
      return cmd;
    },
    params(
      {},
      {
        context: strOpt("Path to ticket-context.json"),
        output: strOpt("Output path"),
      },
    ),
  ),

  cliTool(
    "template_render",
    "Render a template with context variables. Produces formatted HTML or Markdown output from a template and context data.",
    "template-tools",
    (args) => {
      const cmd = ["render"];
      if (args.template) cmd.push("-t", String(args.template));
      if (args.context) cmd.push("-c", String(args.context));
      if (args.output) cmd.push("-o", String(args.output));
      if (args.format) cmd.push("--format", String(args.format));
      return cmd;
    },
    params(
      {},
      {
        template: strOpt("Template path"),
        context: strOpt("Context file path"),
        output: strOpt("Output path"),
        format: strEnum(["html", "markdown"], "Output format"),
      },
    ),
  ),
];

const wikiTools: Tool<Record<string, unknown>>[] = [
  cliTool(
    "wiki_search",
    "Search Azure DevOps wiki pages by keyword. Returns matching pages with paths and content snippets.",
    "wiki-tools",
    (args) => {
      const cmd = ["search", String(args.text)];
      if (args.wiki) cmd.push("--wiki", String(args.wiki));
      return cmd;
    },
    params(
      { text: str("Search text") },
      { wiki: strOpt("Wiki identifier") },
    ),
  ),

  cliTool(
    "wiki_update",
    "Update an existing Azure DevOps wiki page. Provide the page path and new content.",
    "wiki-tools",
    (args) => {
      const cmd = ["update"];
      if (args.path) cmd.push("-p", String(args.path));
      if (args.content) cmd.push("-c", String(args.content));
      if (args.file) cmd.push("-f", String(args.file));
      return cmd;
    },
    params(
      {},
      {
        path: strOpt("Wiki page path"),
        content: strOpt("Page content (inline)"),
        file: strOpt("Path to file with page content"),
      },
    ),
  ),

  cliTool(
    "wiki_get",
    "Get an Azure DevOps wiki page by path or ID. Returns the page content and metadata.",
    "wiki-tools",
    (args) => {
      const cmd = ["get"];
      if (args.path) cmd.push("-p", String(args.path));
      if (args.pageId) cmd.push("--page-id", String(args.pageId));
      return cmd;
    },
    params(
      {},
      {
        path: strOpt("Wiki page path"),
        pageId: strOpt("Wiki page ID"),
      },
    ),
  ),

  cliTool(
    "wiki_create",
    "Create a new Azure DevOps wiki page. Provide the page path and content.",
    "wiki-tools",
    (args) => {
      const cmd = ["create", "-p", String(args.path)];
      if (args.content) cmd.push("-c", String(args.content));
      if (args.file) cmd.push("-f", String(args.file));
      return cmd;
    },
    params(
      { path: str("Wiki page path") },
      {
        content: strOpt("Page content (inline)"),
        file: strOpt("Path to file with page content"),
      },
    ),
  ),
];

// ── Export ────────────────────────────────────────────────────────────

/**
 * Build the full set of Meridian CLI tools for registration with the Copilot SDK.
 * Returns an array of Tool definitions that can be passed to `createSession({ tools })`.
 */
export function buildMeridianTools(): Tool<Record<string, unknown>>[] {
  return [
    ...adoTools,
    ...workflowTools,
    ...crmTools,
    ...templateTools,
    ...wikiTools,
  ];
}
