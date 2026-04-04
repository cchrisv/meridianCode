import type { GetAuthStatusResponse } from "@github/copilot-sdk";
import { describe, expect, it } from "vitest";

import {
  enterpriseCustomerSlugFromHost,
  enterpriseOrganizationLabelFromHost,
  extractCopilotAuthOrganization,
  parseGithubEnterpriseHostname,
  resolveCopilotServerAuth,
} from "./copilotServerAuth.ts";

describe("parseGithubEnterpriseHostname", () => {
  it("returns undefined for github.com", () => {
    expect(parseGithubEnterpriseHostname("https://github.com")).toBeUndefined();
    expect(parseGithubEnterpriseHostname("github.com")).toBeUndefined();
  });

  it("normalizes host", () => {
    expect(parseGithubEnterpriseHostname("https://UMGC-EDU.ghe.com/api")).toBe("umgc-edu.ghe.com");
  });
});

describe("enterpriseOrganizationLabelFromHost", () => {
  it("derives label from ghe.com customer slug", () => {
    expect(enterpriseOrganizationLabelFromHost("https://umgc-edu.ghe.com")).toBe("Umgc Edu");
  });

  it("skips generic github prefix when a better segment exists", () => {
    expect(enterpriseCustomerSlugFromHost("https://github.corp.example")).toBe("corp");
    expect(enterpriseOrganizationLabelFromHost("https://github.corp.example")).toBe("Corp");
  });
});

describe("extractCopilotAuthOrganization", () => {
  it("prefers organization_list name", () => {
    expect(
      extractCopilotAuthOrganization({
        organization_list: [{ login: "acme-corp", name: "Acme Corp" }],
      }),
    ).toBe("Acme Corp");
  });

  it("falls back to organization_list login", () => {
    expect(
      extractCopilotAuthOrganization({
        organization_list: [{ login: "acme-corp" }],
      }),
    ).toBe("acme-corp");
  });

  it("uses organization_login_list when list object is absent", () => {
    expect(
      extractCopilotAuthOrganization({
        organization_login_list: ["widget-co"],
      }),
    ).toBe("widget-co");
  });
});

describe("resolveCopilotServerAuth", () => {
  it("authenticated with login sets label and gh-cli type", () => {
    expect(
      resolveCopilotServerAuth({
        isAuthenticated: true,
        login: "octocat",
        authType: "gh-cli",
      }),
    ).toEqual({
      status: "authenticated",
      label: "octocat",
      type: "GitHub CLI",
    });
  });

  it("includes organization from extended auth payload", () => {
    expect(
      resolveCopilotServerAuth({
        isAuthenticated: true,
        login: "octocat",
        authType: "gh-cli",
        organization_list: [{ login: "acme", name: "Acme Inc" }],
      } as GetAuthStatusResponse),
    ).toEqual({
      status: "authenticated",
      label: "octocat",
      type: "GitHub CLI",
      organization: "Acme Inc",
    });
  });

  it("uses friendly enterprise label and hostname when org list is missing", () => {
    expect(
      resolveCopilotServerAuth({
        isAuthenticated: true,
        login: "octocat",
        authType: "user",
        host: "https://umgc-edu.ghe.com",
      }),
    ).toEqual({
      status: "authenticated",
      label: "octocat",
      type: "GitHub.com",
      organization: "Umgc Edu",
      enterpriseHost: "umgc-edu.ghe.com",
    });
  });

  it("authenticated without login falls back to status message", () => {
    expect(
      resolveCopilotServerAuth({
        isAuthenticated: true,
        statusMessage: "Signed in",
      }),
    ).toEqual({
      status: "authenticated",
      label: "Signed in",
    });
  });

  it("authenticated with empty login uses status message then GitHub", () => {
    expect(
      resolveCopilotServerAuth({
        isAuthenticated: true,
        login: "   ",
      }),
    ).toEqual({
      status: "authenticated",
      label: "GitHub",
    });
  });

  it("unauthenticated", () => {
    expect(
      resolveCopilotServerAuth({
        isAuthenticated: false,
      }),
    ).toEqual({ status: "unauthenticated" });
  });

  it("undefined authStatus is unknown", () => {
    expect(resolveCopilotServerAuth(undefined)).toEqual({ status: "unknown" });
  });
});
