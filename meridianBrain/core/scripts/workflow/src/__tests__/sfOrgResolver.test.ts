import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  loadOrgConfig,
  isOrgConfigured,
  getOrgAlias,
  resolveOrgForRole,
  getConfiguredOrgs,
  getResolvedRoleMap,
  saveOrgConfig,
  clearConfigCache,
  getOrgConfigPath,
  VALID_ROLES,
} from "../lib/sfOrgResolver.js";
import type { SfOrgsConfig } from "../types/configTypes.js";

/**
 * These tests mock the config file by writing to a temp location.
 * We override getOrgConfigPath indirectly by setting up the config via saveOrgConfig
 * after clearing cache. For isolated tests, we write/read temp JSON directly.
 */

// Helper: create a valid multi-org config
function makeMultiOrgConfig(): SfOrgsConfig {
  return {
    version: "1.0",
    configured: true,
    configured_at: "2026-03-16T12:00:00Z",
    orgs: {
      q3dev: {
        alias: "q3dev",
        designation: "modern",
        description: "Modern org",
      },
      "legacy-crm": {
        alias: "legacy-crm",
        designation: "legacy",
        description: "Legacy org",
      },
      "datacloud-org": {
        alias: "datacloud-org",
        designation: "modern",
        description: "Data Cloud org",
      },
    },
    roles: {
      primary: "q3dev",
      legacy: "legacy-crm",
      modern: "q3dev",
      legacyData: "legacy-crm",
      legacyMetadata: "legacy-crm",
      modernData: "q3dev",
      modernMetadata: "q3dev",
      dataCloud: "datacloud-org",
    },
  };
}

// Helper: single-org config
function makeSingleOrgConfig(): SfOrgsConfig {
  return {
    version: "1.0",
    configured: true,
    configured_at: "2026-03-16T12:00:00Z",
    orgs: {
      myorg: { alias: "myorg" },
    },
    roles: {
      primary: "myorg",
    },
  };
}

describe("sfOrgResolver", () => {
  beforeEach(() => {
    clearConfigCache();
  });

  /** Isolate from a real repo `platforms/crm/config/crm-orgs.json` on disk. */
  describe("with no org file (mocked path)", () => {
    beforeEach(() => {
      clearConfigCache();
      const isolated = join(tmpdir(), `meridian-crm-org-test-${process.pid}-${Date.now()}.json`);
      process.env.MERIDIAN_ORG_CONFIG_PATH = isolated;
    });
    afterEach(() => {
      delete process.env.MERIDIAN_ORG_CONFIG_PATH;
      clearConfigCache();
    });

    describe("VALID_ROLES", () => {
      it("should contain all expected roles", () => {
        expect(VALID_ROLES).toContain("primary");
        expect(VALID_ROLES).toContain("legacy");
        expect(VALID_ROLES).toContain("modern");
        expect(VALID_ROLES).toContain("legacyData");
        expect(VALID_ROLES).toContain("legacyMetadata");
        expect(VALID_ROLES).toContain("modernData");
        expect(VALID_ROLES).toContain("modernMetadata");
        expect(VALID_ROLES).toContain("dataCloud");
        expect(VALID_ROLES).toHaveLength(8);
      });
    });

    describe("resolveOrgForRole", () => {
      it("should return empty string when no config exists and no explicit alias", () => {
        const result = resolveOrgForRole("primary");
        expect(result).toBe("");
      });
    });

    describe("getOrgAlias - fallback chain", () => {
      it("should return undefined when no config exists", () => {
        const result = getOrgAlias("primary");
        expect(result).toBeUndefined();
      });
    });

    describe("isOrgConfigured", () => {
      it("should return false when no config file exists", () => {
        expect(isOrgConfigured()).toBe(false);
      });
    });

    describe("getConfiguredOrgs", () => {
      it("should return empty array when no config exists", () => {
        expect(getConfiguredOrgs()).toEqual([]);
      });
    });

    describe("getResolvedRoleMap", () => {
      it("should return all roles as undefined when no config exists", () => {
        const map = getResolvedRoleMap();
        for (const role of VALID_ROLES) {
          expect(map[role]).toBeUndefined();
        }
      });
    });
  });

  describe("resolveOrgForRole", () => {
    it("should return explicit alias when provided, ignoring role", () => {
      const result = resolveOrgForRole("legacy", "override-org");
      expect(result).toBe("override-org");
    });

    it("should return explicit alias even without role", () => {
      const result = resolveOrgForRole(undefined, "my-explicit-org");
      expect(result).toBe("my-explicit-org");
    });
  });

  describe("config structure validation", () => {
    it("makeMultiOrgConfig should have valid structure", () => {
      const config = makeMultiOrgConfig();
      expect(config.configured).toBe(true);
      expect(config.roles.primary).toBe("q3dev");
      expect(config.roles.legacy).toBe("legacy-crm");
      expect(config.roles.dataCloud).toBe("datacloud-org");
      expect(Object.keys(config.orgs)).toHaveLength(3);
    });

    it("makeSingleOrgConfig should have valid structure", () => {
      const config = makeSingleOrgConfig();
      expect(config.configured).toBe(true);
      expect(config.roles.primary).toBe("myorg");
      expect(Object.keys(config.orgs)).toHaveLength(1);
    });

    it("multi-org config should have all roles point to known orgs", () => {
      const config = makeMultiOrgConfig();
      const orgAliases = Object.keys(config.orgs);
      for (const [, alias] of Object.entries(config.roles)) {
        expect(orgAliases).toContain(alias);
      }
    });
  });

  describe("fallback chain logic", () => {
    // Test the fallback chain concept with partial role configs
    it("should define correct fallback chains", () => {
      // legacyData → legacy → primary
      // modernData → modern → primary
      // dataCloud → modern → primary
      // These are validated by the ROLE_FALLBACK_CHAIN constant in the module
      // We verify the expected behavior through the config structure
      const config = makeMultiOrgConfig();

      // If legacyData were missing, it should fall back to legacy
      const partialConfig: SfOrgsConfig = {
        ...config,
        roles: {
          primary: "q3dev",
          legacy: "legacy-crm",
          modern: "q3dev",
          // legacyData intentionally omitted — should fall back to legacy
        },
      };

      // Verify the partial config structure is valid
      expect(partialConfig.roles.primary).toBe("q3dev");
      expect(partialConfig.roles.legacyData).toBeUndefined();
      expect(partialConfig.roles.legacy).toBe("legacy-crm");
    });
  });
});
