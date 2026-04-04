/**
 * Salesforce Org Resolver
 * Central module for resolving which Salesforce org to use based on role configuration.
 * All code paths should resolve orgs through this module.
 */

import { readFileSync, existsSync, writeFileSync } from "fs";
import { resolve } from "path";
import { getProjectRoot, loadSharedConfig } from "./configLoader.js";
import { logInfo, logDebug, logWarn } from "./loggerStructured.js";
import type {
  SfOrgRole,
  SfOrgsConfig,
  SfOrgEntry,
  OrgValidationResult,
} from "../types/configTypes.js";

/**
 * Fallback chains for compound roles.
 * If a specific role isn't configured, fall back through the chain.
 */
const ROLE_FALLBACK_CHAIN: Record<SfOrgRole, SfOrgRole[]> = {
  primary: [],
  legacy: ["primary"],
  modern: ["primary"],
  legacyData: ["legacy", "primary"],
  legacyMetadata: ["legacy", "primary"],
  modernData: ["modern", "primary"],
  modernMetadata: ["modern", "primary"],
  dataCloud: ["modern", "primary"],
};

/** All valid org role values */
export const VALID_ROLES: SfOrgRole[] = [
  "primary",
  "legacy",
  "modern",
  "legacyData",
  "legacyMetadata",
  "modernData",
  "modernMetadata",
  "dataCloud",
];

/** Cached config to avoid repeated file reads within a single process */
let cachedConfig: SfOrgsConfig | null | undefined;

/**
 * Path to CRM org roles file (Meridian: platforms/crm/config/crm-orgs.json).
 */
export function getOrgConfigPath(): string {
  const override = process.env.MERIDIAN_ORG_CONFIG_PATH;
  if (override) {
    return resolve(override);
  }
  try {
    const cfg = loadSharedConfig() as { sf_defaults?: { org_config?: string } };
    if (cfg.sf_defaults?.org_config) {
      return resolve(getProjectRoot(), cfg.sf_defaults.org_config);
    }
  } catch {
    /* shared.json missing */
  }
  return resolve(getProjectRoot(), "platforms", "crm", "config", "crm-orgs.json");
}

/**
 * Load the sf-orgs.json config. Returns null if not configured or file doesn't exist.
 * Caches the result for the lifetime of the process.
 *
 * @param forceReload - Force re-read from disk (useful after writing config)
 */
export function loadOrgConfig(forceReload = false): SfOrgsConfig | null {
  if (cachedConfig !== undefined && !forceReload) {
    return cachedConfig;
  }

  const configPath = getOrgConfigPath();

  if (!existsSync(configPath)) {
    logDebug("No crm-orgs.json found — org config not set up");
    cachedConfig = null;
    return null;
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    const config = JSON.parse(content) as SfOrgsConfig;

    if (!config.configured) {
      logDebug("crm-orgs.json exists but configured=false");
      cachedConfig = null;
      return null;
    }

    if (!config.roles?.primary) {
      logWarn("crm-orgs.json is missing roles.primary — treating as unconfigured");
      cachedConfig = null;
      return null;
    }

    cachedConfig = config;
    return config;
  } catch (error) {
    logWarn(
      `Failed to parse crm-orgs.json: ${error instanceof Error ? error.message : String(error)}`,
    );
    cachedConfig = null;
    return null;
  }
}

/**
 * Check if multi-org config exists and is valid.
 */
export function isOrgConfigured(): boolean {
  return loadOrgConfig() !== null;
}

/**
 * Get the org alias for a specific role, following the fallback chain.
 * Returns undefined if no config exists.
 *
 * @param role - The org role to resolve
 */
export function getOrgAlias(role: SfOrgRole): string | undefined {
  const config = loadOrgConfig();
  if (!config) return undefined;

  // Check the requested role first
  const directAlias = config.roles[role];
  if (directAlias) return directAlias;

  // Walk the fallback chain
  const chain = ROLE_FALLBACK_CHAIN[role];
  for (const fallbackRole of chain) {
    const alias = config.roles[fallbackRole];
    if (alias) return alias;
  }

  // Should not reach here since primary is required, but just in case
  return config.roles.primary;
}

/**
 * Resolve which org alias to use for a given role.
 *
 * Resolution order:
 *   1. Explicit alias override (CLI --org flag)
 *   2. Role-specific config from sf-orgs.json (with fallback chain)
 *   3. SF CLI default org (when no config file exists)
 *   4. Throw error directing user to run setup
 *
 * @param role - Optional org role to resolve
 * @param explicitAlias - Optional explicit alias override (from --org flag)
 * @returns Resolved org alias
 * @throws Error if no org can be resolved
 */
export function resolveOrgForRole(role?: SfOrgRole, explicitAlias?: string): string {
  // 1. Explicit alias always wins
  if (explicitAlias) {
    logDebug(`Using explicit org alias: ${explicitAlias}`);
    return explicitAlias;
  }

  // 2. Try role-based resolution from config
  const config = loadOrgConfig();
  if (config) {
    const targetRole = role ?? "primary";
    const alias = getOrgAlias(targetRole);
    if (alias) {
      logDebug(`Resolved org for role '${targetRole}': ${alias}`);
      return alias;
    }
  }

  // 3. No config file — return undefined to let sfClient fall back to SF CLI default
  //    This preserves backward compatibility for users who haven't run setup yet.
  if (!config) {
    logDebug("No org config found — deferring to SF CLI default org");
    // Return empty string to signal "use SF CLI default" — the caller
    // (sfClient/authSalesforceCli) handles this by calling getDefaultOrgAlias()
    return "";
  }

  // 4. Config exists but role couldn't be resolved (shouldn't happen with required primary)
  throw new Error(
    "Could not resolve Salesforce org. Run `npx --prefix core/scripts/workflow crm-tools org-setup` to configure.",
  );
}

/**
 * Get all configured org entries.
 */
export function getConfiguredOrgs(): SfOrgEntry[] {
  const config = loadOrgConfig();
  if (!config) return [];
  return Object.values(config.orgs);
}

/**
 * Get the full role-to-alias mapping, resolving all fallbacks.
 * Useful for displaying the current configuration.
 */
export function getResolvedRoleMap(): Record<SfOrgRole, string | undefined> {
  const result = {} as Record<SfOrgRole, string | undefined>;
  for (const role of VALID_ROLES) {
    result[role] = getOrgAlias(role);
  }
  return result;
}

/**
 * Validate that all configured org aliases are authenticated in SF CLI.
 * Requires the validateSfAuth function from authSalesforceCli.
 *
 * @param validateFn - Auth validation function (injected to avoid circular deps)
 * @returns Array of validation results per unique org alias and its roles
 */
export async function validateOrgConfig(
  validateFn: (alias: string) => Promise<void>,
): Promise<OrgValidationResult[]> {
  const config = loadOrgConfig();
  if (!config) {
    return [
      {
        alias: "(none)",
        role: "primary",
        success: false,
        error: "No org configuration found. Run org-setup first.",
      },
    ];
  }

  const results: OrgValidationResult[] = [];
  const checkedAliases = new Set<string>();

  for (const role of VALID_ROLES) {
    const alias = getOrgAlias(role);
    if (!alias || checkedAliases.has(alias)) continue;
    checkedAliases.add(alias);

    try {
      await validateFn(alias);
      results.push({ alias, role, success: true });
    } catch (error) {
      results.push({
        alias,
        role,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

/**
 * Write a new org configuration to disk.
 *
 * @param config - The configuration to save
 */
export function saveOrgConfig(config: SfOrgsConfig): void {
  const configPath = getOrgConfigPath();
  const content = JSON.stringify(config, null, 2) + "\n";
  writeFileSync(configPath, content, "utf-8");
  // Invalidate cache so next load picks up new config
  cachedConfig = undefined;
  logInfo(`Org configuration saved to ${configPath}`);
}

/**
 * Clear the cached config. Useful for testing.
 */
export function clearConfigCache(): void {
  cachedConfig = undefined;
}
