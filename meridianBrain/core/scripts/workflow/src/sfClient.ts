/**
 * Salesforce Client
 * Creates authenticated connections to Salesforce using SF CLI
 */

import { Connection } from "@salesforce/core";
import { getSfConnection, validateSfAuth } from "./lib/authSalesforceCli.js";
import { resolveOrgForRole } from "./lib/sfOrgResolver.js";
import { SF_DEFAULTS } from "./types/sfMetadataTypes.js";
import { logInfo, logDebug } from "./lib/loggerStructured.js";
import type { SfOrgRole } from "./types/configTypes.js";

/**
 * SF connection configuration
 */
export interface SfConnectionConfig {
  /** Org alias or username (overrides role-based resolution) */
  alias?: string;
  /** Org role — resolves to an alias via config/sf-orgs.json */
  role?: SfOrgRole;
  /** API version to use */
  apiVersion?: string;
  /** Skip auth validation */
  skipAuthValidation?: boolean;
}

/**
 * SF connection wrapper with additional helpers
 */
export interface SfConnectionWrapper {
  /** The underlying jsforce Connection */
  connection: Connection;
  /** Org alias */
  alias: string;
  /** API version */
  apiVersion: string;
  /** Instance URL */
  instanceUrl: string;
}

/**
 * Create an authenticated Salesforce connection
 *
 * @param config - Connection configuration
 * @returns SF connection wrapper
 */
export async function createSfConnection(
  config: SfConnectionConfig = {},
): Promise<SfConnectionWrapper> {
  const apiVersion = config.apiVersion ?? SF_DEFAULTS.API_VERSION;

  // Resolve alias: explicit --org > role-based config > primary > SF CLI default
  const resolvedAlias = resolveOrgForRole(config.role, config.alias) || undefined;

  logInfo(
    `Creating SF connection${resolvedAlias ? ` to ${resolvedAlias}` : " (using default org)"}${config.role ? ` (role: ${config.role})` : ""}`,
  );

  // Validate SF CLI auth (getSfConnection handles default org resolution)
  if (!config.skipAuthValidation) {
    await validateSfAuth(resolvedAlias);
  }

  // Get connection using SF CLI auth (will use default org if alias not specified)
  const connection = await getSfConnection(resolvedAlias);

  // Set API version if different from default
  if (apiVersion !== connection.version) {
    logDebug(`Setting API version to ${apiVersion}`);
    connection.version = apiVersion;
  }

  logDebug(`SF connection created: ${connection.instanceUrl}`);

  // Get the actual username from the connection for the wrapper
  const identity = await connection.identity();

  return {
    connection,
    alias: resolvedAlias ?? identity.username,
    apiVersion: connection.version,
    instanceUrl: connection.instanceUrl,
  };
}

/**
 * Get the jsforce Connection object directly.
 * Convenience function for when you need the raw connection.
 *
 * @param config - Optional connection config (alias, apiVersion, skipAuthValidation)
 * @returns The underlying jsforce Connection instance
 */
export async function getConnection(config?: SfConnectionConfig): Promise<Connection> {
  const wrapper = await createSfConnection(config);
  return wrapper.connection;
}

/**
 * Execute a SOQL query.
 * Convenience wrapper that creates connection if needed.
 *
 * @param soql - SOQL query string
 * @param config - Optional connection config
 * @returns Array of record objects
 */
export async function query<T = Record<string, unknown>>(
  soql: string,
  config?: SfConnectionConfig,
): Promise<T[]> {
  const conn = await getConnection(config);
  const result = await conn.query<T>(soql);
  return result.records;
}

/**
 * Execute a Tooling API query.
 * Convenience wrapper that creates connection if needed.
 *
 * @param soql - SOQL query string for Tooling API
 * @param config - Optional connection config
 * @returns Array of record objects
 */
export async function toolingQuery<T = Record<string, unknown>>(
  soql: string,
  config?: SfConnectionConfig,
): Promise<T[]> {
  const conn = await getConnection(config);
  const result = await conn.tooling.query<T>(soql);
  return result.records;
}

/**
 * Get the identity of the authenticated user.
 *
 * @param config - Optional connection config
 * @returns User identity (userId, username, organizationId, displayName, email)
 */
export async function getIdentity(config?: SfConnectionConfig): Promise<SfIdentity> {
  const conn = await getConnection(config);
  const identity = await conn.identity();

  return {
    userId: identity.user_id,
    username: identity.username,
    organizationId: identity.organization_id,
    displayName: identity.display_name,
    email: identity.email,
  };
}

/**
 * SF identity information
 */
export interface SfIdentity {
  userId: string;
  username: string;
  organizationId: string;
  displayName: string;
  email: string;
}

/**
 * Get organization limits (e.g. API calls, storage).
 *
 * @param config - Optional connection config
 * @returns Map of limit name to { Max, Remaining }
 */
export async function getOrgLimits(config?: SfConnectionConfig): Promise<Record<string, OrgLimit>> {
  const conn = await getConnection(config);
  const limits = await conn.limits();
  return limits as Record<string, OrgLimit>;
}

/**
 * Org limit information
 */
export interface OrgLimit {
  Max: number;
  Remaining: number;
}

/**
 * Test connection to Salesforce and return identity or error.
 *
 * @param config - Optional connection config
 * @returns Success flag, username/orgId/responseTimeMs on success, or error message on failure
 */
export async function testConnection(config?: SfConnectionConfig): Promise<ConnectionTestResult> {
  try {
    const start = Date.now();
    const identity = await getIdentity(config);
    const duration = Date.now() - start;

    return {
      success: true,
      username: identity.username,
      organizationId: identity.organizationId,
      responseTimeMs: duration,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Connection test result
 */
export interface ConnectionTestResult {
  success: boolean;
  username?: string;
  organizationId?: string;
  responseTimeMs?: number;
  error?: string;
}
