import type { GetAuthStatusResponse } from "@github/copilot-sdk";
import type { ServerProviderAuth } from "@t3tools/contracts";

import { nonEmptyTrimmed } from "./providerSnapshot.ts";

function labelForAuthType(
  authType: GetAuthStatusResponse["authType"] | undefined,
): string | undefined {
  if (authType === undefined) return undefined;
  switch (authType) {
    case "gh-cli":
      return "GitHub CLI";
    case "user":
      return "GitHub.com";
    case "env":
      return "Environment";
    case "hmac":
      return "HMAC";
    case "api-key":
      return "API key";
    case "token":
      return "Token";
    default:
      return authType;
  }
}

/** e.g. `https://UMGC-EDU.ghe.com/foo` → `umgc-edu.ghe.com` */
export function parseGithubEnterpriseHostname(host: string | undefined): string | undefined {
  const raw = nonEmptyTrimmed(host);
  if (!raw) return undefined;
  const noProto = raw
    .replace(/^https?:\/\//i, "")
    .split("/")[0]
    ?.toLowerCase();
  if (!noProto || noProto === "github.com") return undefined;
  return noProto;
}

function titleCaseFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Prefer the customer slug (first label), skipping a leading `github` segment when it is only the product hostname.
 * `umgc-edu.ghe.com` → `umgc-edu`; `github.corp.example` → `corp`.
 */
export function enterpriseCustomerSlugFromHost(host: string | undefined): string | undefined {
  const hostname = parseGithubEnterpriseHostname(host);
  if (!hostname) return undefined;
  const parts = hostname.split(".").filter((p) => p.length > 0);
  if (parts.length === 0) return undefined;
  let slug = parts[0];
  if (slug === "github" && parts.length > 1) {
    slug = parts[1];
  }
  if (!slug || slug === "ghe") return undefined;
  return slug;
}

/** Human-readable company-style label for GHE when org APIs omit `organization_list`. */
export function enterpriseOrganizationLabelFromHost(host: string | undefined): string | undefined {
  const slug = enterpriseCustomerSlugFromHost(host);
  if (!slug) return undefined;
  const titled = titleCaseFromSlug(slug);
  return titled.length > 0 ? titled : undefined;
}

/**
 * Copilot `auth.getStatus` may include Copilot user org fields at runtime (not in SDK typings).
 * See GitHub Copilot user payload: `organization_list`, `organization_login_list`.
 */
export function extractCopilotAuthOrganization(authStatus: unknown): string | undefined {
  if (!authStatus || typeof authStatus !== "object") return undefined;
  const record = authStatus as Record<string, unknown>;

  const orgList = record["organization_list"];
  if (Array.isArray(orgList)) {
    for (const entry of orgList) {
      if (!entry || typeof entry !== "object") continue;
      const org = entry as Record<string, unknown>;
      const name = nonEmptyTrimmed(typeof org.name === "string" ? org.name : undefined);
      if (name) return name;
      const login = nonEmptyTrimmed(typeof org.login === "string" ? org.login : undefined);
      if (login) return login;
    }
  }

  const loginList = record["organization_login_list"];
  if (Array.isArray(loginList)) {
    for (const entry of loginList) {
      if (typeof entry === "string") {
        const trimmed = nonEmptyTrimmed(entry);
        if (trimmed) return trimmed;
      }
    }
  }

  return undefined;
}

/** Maps Copilot SDK auth.getStatus into server provider auth for the web UI. */
export function resolveCopilotServerAuth(
  authStatus: GetAuthStatusResponse | undefined,
): ServerProviderAuth {
  if (authStatus?.isAuthenticated === true) {
    const login = nonEmptyTrimmed(authStatus.login);
    const statusMsg = nonEmptyTrimmed(authStatus.statusMessage);
    const label = login ?? statusMsg ?? "GitHub";
    const type = labelForAuthType(authStatus.authType);
    const organizationFromApi = extractCopilotAuthOrganization(authStatus);
    const enterpriseHost = parseGithubEnterpriseHostname(authStatus.host);
    const organizationFromHost =
      organizationFromApi === undefined
        ? enterpriseOrganizationLabelFromHost(authStatus.host)
        : undefined;
    const organization = organizationFromApi ?? organizationFromHost;
    return {
      status: "authenticated",
      label,
      ...(type ? { type } : {}),
      ...(organization ? { organization } : {}),
      ...(enterpriseHost ? { enterpriseHost } : {}),
    };
  }
  if (authStatus?.isAuthenticated === false) {
    return { status: "unauthenticated" };
  }
  return { status: "unknown" };
}
