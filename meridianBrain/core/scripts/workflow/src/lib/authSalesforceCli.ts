/**
 * Salesforce CLI Authentication
 * Reuses existing SF CLI authentication sessions
 */

import { AuthInfo, Connection, Org, ConfigAggregator } from "@salesforce/core";

/**
 * Connection cache to avoid repeated auth lookups
 */
const connectionCache = new Map<string, Connection>();

/**
 * Get the default org alias/username from SF CLI config
 *
 * @returns The default org alias or undefined if not set
 */
async function getDefaultOrgAlias(): Promise<string | undefined> {
  try {
    const configAggregator = await ConfigAggregator.create();
    const targetOrg = configAggregator.getPropertyValue("target-org");
    return typeof targetOrg === "string" ? targetOrg : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Get a Salesforce connection using existing SF CLI authentication
 *
 * @param aliasOrUsername - Org alias or username (if not provided, uses default org)
 * @returns Salesforce Connection instance
 * @throws Error if not authenticated to the specified org
 */
export async function getSfConnection(aliasOrUsername?: string): Promise<Connection> {
  // If no alias provided, get the default org
  let targetAlias = aliasOrUsername;
  if (!targetAlias) {
    targetAlias = await getDefaultOrgAlias();
    if (!targetAlias) {
      throw new Error(
        "No default Salesforce org is set. Please run: sf config set target-org <alias>",
      );
    }
  }

  // Check cache first
  const cached = connectionCache.get(targetAlias);
  if (cached) {
    // Verify connection is still valid
    try {
      await cached.identity();
      return cached;
    } catch {
      // Connection expired, remove from cache
      connectionCache.delete(targetAlias);
    }
  }

  try {
    // Use Org.create which handles alias resolution automatically
    const org = await Org.create({ aliasOrUsername: targetAlias });
    const connection = org.getConnection();

    // Cache the connection using the alias/username that was requested
    connectionCache.set(targetAlias, connection);

    return connection;
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message.includes("No authorization found") ||
        error.message.includes("NamedOrgNotFound") ||
        error.message.includes("No authorization information")
      ) {
        throw new Error(
          `Salesforce org '${targetAlias}' is not authenticated. Please run: sf org login web -a ${targetAlias}`,
        );
      }
      throw new Error(`Failed to connect to Salesforce: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Validate that SF CLI is authenticated to the specified org
 *
 * @param alias - Org alias or username to validate (uses default if not provided)
 * @throws Error if not authenticated
 */
export async function validateSfAuth(alias?: string): Promise<void> {
  let targetAlias = alias;
  if (!targetAlias) {
    targetAlias = await getDefaultOrgAlias();
    if (!targetAlias) {
      throw new Error("No default Salesforce org is set.");
    }
  }

  const auths = await AuthInfo.listAllAuthorizations();

  const found = auths.some(
    (auth) => auth.username === targetAlias || auth.aliases?.includes(targetAlias!),
  );

  if (!found) {
    throw new Error(
      `Salesforce org '${targetAlias}' is not authenticated. Please run: sf org login web -a ${targetAlias}`,
    );
  }
}

/**
 * List all authenticated Salesforce orgs
 *
 * @returns Array of org information
 */
export async function listSfOrgs(): Promise<SfOrgInfo[]> {
  const auths = await AuthInfo.listAllAuthorizations();

  return auths.map((auth) => ({
    username: auth.username,
    aliases: auth.aliases ?? [],
    instanceUrl: auth.instanceUrl ?? "",
    orgId: auth.orgId ?? "",
    isDefaultUsername: auth.isDefaultUsername ?? false,
    isDefaultDevhubUsername: auth.isDefaultDevhubUsername ?? false,
  }));
}

/**
 * Get detailed org information
 *
 * @param alias - Org alias or username (uses default if not provided)
 * @returns Org details
 */
export async function getSfOrgInfo(alias?: string): Promise<SfOrgDetails> {
  const connection = await getSfConnection(alias);
  await Org.create({ connection });

  const identity = await connection.identity();

  return {
    username: identity.username,
    orgId: identity.organization_id,
    userId: identity.user_id,
    instanceUrl: connection.instanceUrl,
    apiVersion: connection.version,
    accessToken: connection.accessToken ?? "",
  };
}

/**
 * Salesforce org information
 */
export interface SfOrgInfo {
  username: string;
  aliases: string[];
  instanceUrl: string;
  orgId: string;
  isDefaultUsername: boolean;
  isDefaultDevhubUsername: boolean;
}

/**
 * Detailed Salesforce org information
 */
export interface SfOrgDetails {
  username: string;
  orgId: string;
  userId: string;
  instanceUrl: string;
  apiVersion: string;
  accessToken: string;
}

/**
 * Clear the connection cache.
 * Use after switching orgs or when connections may be stale.
 */
export function clearConnectionCache(): void {
  connectionCache.clear();
}

/**
 * Remove a specific connection from cache.
 *
 * @param alias - Org alias or username to remove from cache
 */
export function removeFromCache(alias: string): void {
  connectionCache.delete(alias);
}
