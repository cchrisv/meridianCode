/**
 * Azure CLI Authentication
 * Provides bearer token authentication using Azure CLI
 */

import { execSync } from "child_process";
import { ADO_RESOURCE_ID } from "../types/adoFieldTypes.js";

/**
 * Cache for bearer tokens to avoid repeated CLI calls
 */
interface TokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes before expiry

/**
 * Get a bearer token for Azure DevOps using Azure CLI
 *
 * @returns Bearer token string
 * @throws Error if Azure CLI is not authenticated
 */
export function getAzureBearerToken(): string {
  // Check cache first
  if (tokenCache && Date.now() < tokenCache.expiresAt - TOKEN_EXPIRY_BUFFER_MS) {
    return tokenCache.token;
  }

  try {
    // Get token with expiry info
    const result = execSync(
      `az account get-access-token --resource ${ADO_RESOURCE_ID} --query "{token:accessToken,expiresOn:expiresOn}" -o json`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
    );

    const parsed = JSON.parse(result) as { token: string; expiresOn: string };
    const expiresAt = new Date(parsed.expiresOn).getTime();

    // Cache the token
    tokenCache = {
      token: parsed.token,
      expiresAt,
    };

    return parsed.token;
  } catch (error) {
    // Clear cache on error
    tokenCache = null;

    if (error instanceof Error) {
      if (
        error.message.includes("az: command not found") ||
        error.message.includes("is not recognized")
      ) {
        throw new Error(
          "Azure CLI is not installed. Please install it from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli",
        );
      }
      if (error.message.includes("AADSTS") || error.message.includes("Please run")) {
        throw new Error("Azure CLI is not authenticated. Please run: az login");
      }
      throw new Error(`Failed to get Azure bearer token: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Validate that Azure CLI is authenticated
 *
 * @throws Error if Azure CLI is not installed or not authenticated
 */
export function validateAzureAuth(): void {
  try {
    execSync("az account show", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message.includes("az: command not found") ||
        error.message.includes("is not recognized")
      ) {
        throw new Error(
          "Azure CLI is not installed. Please install it from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli",
        );
      }
      throw new Error("Azure CLI is not authenticated. Please run: az login");
    }
    throw error;
  }
}

/**
 * Get the current Azure account information
 *
 * @returns Account information including subscription and tenant
 */
export function getAzureAccountInfo(): AzureAccountInfo {
  validateAzureAuth();

  const result = execSync(
    'az account show --query "{subscription:name,subscriptionId:id,tenantId:tenantId,user:user.name}" -o json',
    { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
  );

  return JSON.parse(result) as AzureAccountInfo;
}

/**
 * Azure account information
 */
export interface AzureAccountInfo {
  subscription: string;
  subscriptionId: string;
  tenantId: string;
  user: string;
}

/**
 * Cache for Microsoft Graph bearer tokens
 */
let graphTokenCache: TokenCache | null = null;

const GRAPH_RESOURCE_ID = "https://graph.microsoft.com";

/**
 * Get a bearer token for Microsoft Graph using Azure CLI
 *
 * @returns Bearer token string
 * @throws Error if Azure CLI is not authenticated
 */
export function getGraphBearerToken(): string {
  // Check cache first
  if (graphTokenCache && Date.now() < graphTokenCache.expiresAt - TOKEN_EXPIRY_BUFFER_MS) {
    return graphTokenCache.token;
  }

  try {
    const result = execSync(
      `az account get-access-token --resource ${GRAPH_RESOURCE_ID} --query "{token:accessToken,expiresOn:expiresOn}" -o json`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
    );

    const parsed = JSON.parse(result) as { token: string; expiresOn: string };
    const expiresAt = new Date(parsed.expiresOn).getTime();

    graphTokenCache = {
      token: parsed.token,
      expiresAt,
    };

    return parsed.token;
  } catch (error) {
    graphTokenCache = null;

    if (error instanceof Error) {
      if (
        error.message.includes("az: command not found") ||
        error.message.includes("is not recognized")
      ) {
        throw new Error(
          "Azure CLI is not installed. Please install it from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli",
        );
      }
      if (error.message.includes("AADSTS") || error.message.includes("Please run")) {
        throw new Error("Azure CLI is not authenticated. Please run: az login");
      }
      throw new Error(`Failed to get Microsoft Graph bearer token: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Clear the token cache (useful for testing or forced refresh)
 */
export function clearTokenCache(): void {
  tokenCache = null;
  graphTokenCache = null;
}
