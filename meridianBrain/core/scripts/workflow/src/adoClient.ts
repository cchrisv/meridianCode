/**
 * Azure DevOps Client
 * Creates authenticated connections to Azure DevOps
 */

import * as azdev from "azure-devops-node-api";
import type { IWorkItemTrackingApi } from "azure-devops-node-api/WorkItemTrackingApi.js";
import type { IWikiApi } from "azure-devops-node-api/WikiApi.js";
import type { ICoreApi } from "azure-devops-node-api/CoreApi.js";
import type { IGitApi } from "azure-devops-node-api/GitApi.js";
import { getAzureBearerToken, validateAzureAuth } from "./lib/authAzureCli.js";
import { DEFAULT_ADO_ORG, DEFAULT_ADO_PROJECT } from "./types/adoFieldTypes.js";
import { logInfo, logDebug } from "./lib/loggerStructured.js";

/**
 * ADO connection configuration
 */
export interface AdoConnectionConfig {
  /** Azure DevOps organization URL (default: https://dev.azure.com/UMGC) */
  orgUrl?: string;
  /** Project name (default: Digital Platforms) */
  project?: string;
  /** Skip auth validation (for testing) */
  skipAuthValidation?: boolean;
}

/**
 * ADO connection with APIs
 */
export interface AdoConnection {
  /** The WebApi connection */
  connection: azdev.WebApi;
  /** Organization URL */
  orgUrl: string;
  /** Project name */
  project: string;
  /** Get Work Item Tracking API */
  getWorkItemTrackingApi: () => Promise<IWorkItemTrackingApi>;
  /** Get Wiki API */
  getWikiApi: () => Promise<IWikiApi>;
  /** Get Core API */
  getCoreApi: () => Promise<ICoreApi>;
  /** Get Git API */
  getGitApi: () => Promise<IGitApi>;
}

/**
 * Cached connection to avoid re-creating for each operation
 */
let cachedConnection: AdoConnection | null = null;
let cachedConfig: AdoConnectionConfig | null = null;

/**
 * Check if config has changed
 */
function configChanged(config: AdoConnectionConfig): boolean {
  if (!cachedConfig) return true;
  return config.orgUrl !== cachedConfig.orgUrl || config.project !== cachedConfig.project;
}

/**
 * Create an authenticated connection to Azure DevOps
 *
 * @param config - Connection configuration
 * @returns ADO connection with APIs
 */
export async function createAdoConnection(
  config: AdoConnectionConfig = {},
): Promise<AdoConnection> {
  const orgUrl = config.orgUrl ?? DEFAULT_ADO_ORG;
  const project = config.project ?? DEFAULT_ADO_PROJECT;

  // Return cached connection if config hasn't changed
  if (cachedConnection && !configChanged(config)) {
    logDebug("Using cached ADO connection");
    return cachedConnection;
  }

  logInfo(`Creating ADO connection to ${orgUrl}`);

  // Validate Azure CLI auth
  if (!config.skipAuthValidation) {
    validateAzureAuth();
  }

  // Get bearer token from Azure CLI
  const token = getAzureBearerToken();

  // Create auth handler with bearer token
  const authHandler = azdev.getBearerHandler(token);

  // Create connection
  const connection = new azdev.WebApi(orgUrl, authHandler);

  // Create the connection object
  const adoConnection: AdoConnection = {
    connection,
    orgUrl,
    project,
    getWorkItemTrackingApi: () => connection.getWorkItemTrackingApi(),
    getWikiApi: () => connection.getWikiApi(),
    getCoreApi: () => connection.getCoreApi(),
    getGitApi: () => connection.getGitApi(),
  };

  // Cache the connection
  cachedConnection = adoConnection;
  cachedConfig = { orgUrl, project };

  logDebug("ADO connection created successfully");
  return adoConnection;
}

/**
 * Clear the cached connection (useful for testing or forced refresh)
 */
export function clearAdoConnectionCache(): void {
  cachedConnection = null;
  cachedConfig = null;
}

/**
 * Get the Work Item Tracking API
 * Convenience function that creates connection if needed
 */
export async function getWorkItemTrackingApi(
  config?: AdoConnectionConfig,
): Promise<IWorkItemTrackingApi> {
  const conn = await createAdoConnection(config);
  return conn.getWorkItemTrackingApi();
}

/**
 * Get the Wiki API
 * Convenience function that creates connection if needed
 */
export async function getWikiApi(config?: AdoConnectionConfig): Promise<IWikiApi> {
  const conn = await createAdoConnection(config);
  return conn.getWikiApi();
}

/**
 * Get the Core API
 * Convenience function that creates connection if needed
 */
export async function getCoreApi(config?: AdoConnectionConfig): Promise<ICoreApi> {
  const conn = await createAdoConnection(config);
  return conn.getCoreApi();
}
