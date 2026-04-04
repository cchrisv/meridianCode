/**
 * Configuration Types
 * Type definitions for shared configuration
 */

/**
 * Shared configuration structure
 */
export interface SharedConfig {
  scripts: ScriptsConfig;
  cli_commands: CliCommandsConfig;
  paths: PathsConfig;
  defaults: DefaultsConfig;
}

/**
 * Scripts configuration
 */
export interface ScriptsConfig {
  metadata_dependencies: string;
  scripts_path: string;
}

/**
 * CLI commands configuration
 */
export interface CliCommandsConfig {
  ado_get: string;
  ado_update: string;
  ado_create: string;
  ado_search: string;
  ado_link: string;
  sf_query: string;
  sf_describe: string;
  sf_discover: string;
  wiki_update: string;
}

/**
 * Paths configuration
 */
export interface PathsConfig {
  artifacts_root: string;
  reports: string;
  scripts: string;
  prompts: string;
  config: string;
  templates: string;
  standards: {
    core: string;
    ado: string;
    salesforce: string;
  };
}

/**
 * Default values configuration
 */
export interface DefaultsConfig {
  ado_org: string;
  ado_project: string;
  sf_org?: string;
  org_config?: string;
  wiki_name: string;
}

/**
 * Template variables structure
 */
export interface TemplateVariables {
  workItemId?: number;
  workItemType?: string;
  projectName?: string;
  areaPath?: string;
  iterationPath?: string;
  assignedTo?: string;
  sfOrg?: string;
  sfOrgRole?: SfOrgRole;
  timestamp?: string;
  [key: string]: unknown;
}

// --- Multi-Org Salesforce Configuration ---

/**
 * Org roles — combines designation (legacy/modern) with function (data/metadata).
 * 'primary' is the fallback for any unspecified role.
 *
 * Fallback chain:
 *   legacyData → legacy → primary
 *   legacyMetadata → legacy → primary
 *   modernData → modern → primary
 *   modernMetadata → modern → primary
 *   dataCloud → modern → primary
 */
export type SfOrgRole =
  | "primary"
  | "legacy"
  | "modern"
  | "legacyData"
  | "legacyMetadata"
  | "modernData"
  | "modernMetadata"
  | "dataCloud";

/** Org designation within a two-org implementation */
export type SfOrgDesignation = "legacy" | "modern";

/** Individual org entry in the multi-org config */
export interface SfOrgEntry {
  alias: string;
  designation?: SfOrgDesignation;
  description?: string;
}

/** Multi-org configuration stored in config/sf-orgs.json */
export interface SfOrgsConfig {
  version: string;
  configured: boolean;
  configured_at: string;
  orgs: Record<string, SfOrgEntry>;
  roles: Partial<Record<SfOrgRole, string>> & { primary: string };
}

/** Result of validating an org's authentication */
export interface OrgValidationResult {
  alias: string;
  role: SfOrgRole;
  success: boolean;
  error?: string;
}
