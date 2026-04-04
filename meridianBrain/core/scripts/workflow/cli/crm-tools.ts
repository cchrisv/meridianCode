#!/usr/bin/env node
/**
 * CRM Tools CLI (Meridian)
 * Salesforce / CRM query and metadata operations
 */

import { Command } from "commander";
import { executeSoqlQuery, executeToolingQuery, queryAll } from "../src/sfQueryExecutor.js";
import {
  describeObject,
  describeField,
  getApexClasses,
  getApexTriggers,
  getValidationRules,
  getFlows,
  getCustomObjects,
} from "../src/sfMetadataDescriber.js";
import { discoverDependencies, exportGraphToJson } from "../src/sfDependencyDiscovery.js";
import { configureLogger } from "../src/lib/loggerStructured.js";
import type { MetadataType } from "../src/types/sfDependencyTypes.js";
import type { SfOrgRole } from "../src/types/configTypes.js";
import type { SfConnectionConfig } from "../src/sfClient.js";

/** Build SfConnectionConfig from CLI options (--org and --role flags) */
function buildConnectionConfig(options: { org?: string; role?: string }): SfConnectionConfig {
  return {
    alias: options.org,
    role: options.role as SfOrgRole | undefined,
  };
}

const program = new Command();

program
  .name("crm-tools")
  .description("CRM (Salesforce) query and metadata operations")
  .version("2.0.0");

// Query command
program
  .command("query <soql>")
  .description("Execute a SOQL query")
  .option("--tooling", "Use Tooling API")
  .option("--all", "Fetch all records (handle pagination)")
  .option("-o, --org <alias>", "Org alias (overrides role-based config)")
  .option(
    "-r, --role <role>",
    "Org role: primary|legacy|modern|legacyData|legacyMetadata|modernData|modernMetadata|dataCloud",
  )
  .option("--json", "Output as JSON (default)")
  .option("-v, --verbose", "Verbose output")
  .action(async (soql: string, options) => {
    try {
      // Silence logs when outputting JSON to keep stdout clean
      if (options.json || !options.verbose) {
        configureLogger({ silent: true });
      } else if (options.verbose) {
        configureLogger({ minLevel: "debug" });
      }

      let result;

      if (options.all && !options.tooling) {
        // Use queryAll for full pagination
        result = await queryAll(soql, buildConnectionConfig(options));
        console.log(JSON.stringify({ totalSize: result.length, records: result }, null, 2));
      } else if (options.tooling) {
        result = await executeToolingQuery(soql, buildConnectionConfig(options));
        console.log(JSON.stringify(result, null, 2));
      } else {
        result = await executeSoqlQuery(soql, buildConnectionConfig(options));
        console.log(JSON.stringify(result, null, 2));
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Describe command
program
  .command("describe <objectNames>")
  .description("Describe one or more SObjects (comma-separated for batch)")
  .option("-f, --field <fieldName>", "Describe a specific field")
  .option("--fields-only", "Only output field information")
  .option("--batch", "Process multiple objects in parallel (comma-separated)")
  .option("-o, --org <alias>", "Org alias (overrides role-based config)")
  .option(
    "-r, --role <role>",
    "Org role: primary|legacy|modern|legacyData|legacyMetadata|modernData|modernMetadata|dataCloud",
  )
  .option("--json", "Output as JSON (default)")
  .option("-v, --verbose", "Verbose output")
  .action(async (objectNames: string, options) => {
    try {
      // Silence logs by default for clean JSON output, unless verbose
      if (options.verbose) {
        configureLogger({ minLevel: "debug" });
      } else {
        configureLogger({ silent: true });
      }

      // Batch processing for multiple objects
      if (options.batch || objectNames.includes(",")) {
        const objectList = objectNames.split(",").map((s) => s.trim());
        const results = await Promise.all(
          objectList.map(async (objName) => {
            try {
              const describe = await describeObject(objName, buildConnectionConfig(options));
              return {
                objectName: objName,
                success: true,
                data: options.fieldsOnly ? describe.fields : describe,
              };
            } catch (error) {
              return {
                objectName: objName,
                success: false,
                error: error instanceof Error ? error.message : String(error),
              };
            }
          }),
        );
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      // Single object processing
      if (options.field) {
        // Describe specific field
        const field = await describeField(
          objectNames,
          options.field,
          buildConnectionConfig(options),
        );
        console.log(JSON.stringify(field, null, 2));
      } else {
        // Describe object
        const describe = await describeObject(objectNames, buildConnectionConfig(options));

        if (options.fieldsOnly) {
          console.log(JSON.stringify(describe.fields, null, 2));
        } else {
          console.log(JSON.stringify(describe, null, 2));
        }
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Discover command
program
  .command("discover")
  .description("Discover metadata dependencies for one or more components")
  .requiredOption("--type <type>", "Metadata type (CustomObject, CustomField, ApexClass, etc.)")
  .requiredOption("--name <names>", "Component name (comma-separated for batch)")
  .option("--depth <n>", "Maximum traversal depth", (v: string) => parseInt(v, 10), 3)
  .option("--include-standard", "Include standard objects")
  .option("--batch", "Process multiple components in parallel (comma-separated)")
  .option("-o, --org <alias>", "Org alias (overrides role-based config)")
  .option(
    "-r, --role <role>",
    "Org role: primary|legacy|modern|legacyData|legacyMetadata|modernData|modernMetadata|dataCloud",
  )
  .option("--json", "Output as JSON (default)")
  .option("-v, --verbose", "Verbose output")
  .action(async (options) => {
    try {
      // Silence logs by default for clean JSON output, unless verbose
      if (options.verbose) {
        configureLogger({ minLevel: "debug" });
      } else {
        configureLogger({ silent: true });
      }

      // Batch processing for multiple components
      if (options.batch || options.name.includes(",")) {
        const nameList = options.name.split(",").map((s: string) => s.trim());
        const results = await Promise.all(
          nameList.map(async (componentName: string) => {
            try {
              const result = await discoverDependencies(
                {
                  rootType: options.type as MetadataType,
                  rootName: componentName,
                  maxDepth: options.depth,
                  includeStandardObjects: options.includeStandard,
                },
                buildConnectionConfig(options),
              );

              return {
                componentName,
                success: true,
                graph: JSON.parse(exportGraphToJson(result.graph)),
                pills: result.pills,
                warnings: result.warnings,
                executionTime: result.executionTime,
              };
            } catch (error) {
              return {
                componentName,
                success: false,
                error: error instanceof Error ? error.message : String(error),
              };
            }
          }),
        );
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      // Single component processing
      const result = await discoverDependencies(
        {
          rootType: options.type as MetadataType,
          rootName: options.name,
          maxDepth: options.depth,
          includeStandardObjects: options.includeStandard,
        },
        buildConnectionConfig(options),
      );

      // Convert graph to JSON-serializable format
      const output = {
        graph: JSON.parse(exportGraphToJson(result.graph)),
        pills: result.pills,
        warnings: result.warnings,
        executionTime: result.executionTime,
      };

      console.log(JSON.stringify(output, null, 2));
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Apex classes command
program
  .command("apex-classes")
  .description("List Apex classes")
  .option("--pattern <pattern>", "Name pattern (use % for wildcard)")
  .option("-o, --org <alias>", "Org alias (overrides role-based config)")
  .option(
    "-r, --role <role>",
    "Org role: primary|legacy|modern|legacyData|legacyMetadata|modernData|modernMetadata|dataCloud",
  )
  .option("--json", "Output as JSON (default)")
  .option("-v, --verbose", "Verbose output")
  .action(async (options) => {
    try {
      // Silence logs by default for clean JSON output, unless verbose
      if (options.verbose) {
        configureLogger({ minLevel: "debug" });
      } else {
        configureLogger({ silent: true });
      }

      const classes = await getApexClasses(options.pattern, buildConnectionConfig(options));
      console.log(JSON.stringify(classes, null, 2));
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Apex triggers command
program
  .command("apex-triggers")
  .description("List Apex triggers")
  .option("--object <name>", "Filter by object name")
  .option("-o, --org <alias>", "Org alias (overrides role-based config)")
  .option(
    "-r, --role <role>",
    "Org role: primary|legacy|modern|legacyData|legacyMetadata|modernData|modernMetadata|dataCloud",
  )
  .option("--json", "Output as JSON (default)")
  .option("-v, --verbose", "Verbose output")
  .action(async (options) => {
    try {
      // Silence logs by default for clean JSON output, unless verbose
      if (options.verbose) {
        configureLogger({ minLevel: "debug" });
      } else {
        configureLogger({ silent: true });
      }

      const triggers = await getApexTriggers(options.object, buildConnectionConfig(options));
      console.log(JSON.stringify(triggers, null, 2));
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Validation rules command
program
  .command("validation-rules <objectNames>")
  .description("List validation rules for one or more objects (comma-separated for batch)")
  .option("--all", "Include inactive rules")
  .option("--batch", "Process multiple objects in parallel (comma-separated)")
  .option("-o, --org <alias>", "Org alias (overrides role-based config)")
  .option(
    "-r, --role <role>",
    "Org role: primary|legacy|modern|legacyData|legacyMetadata|modernData|modernMetadata|dataCloud",
  )
  .option("--json", "Output as JSON (default)")
  .option("-v, --verbose", "Verbose output")
  .action(async (objectNames: string, options) => {
    try {
      // Silence logs by default for clean JSON output, unless verbose
      if (options.verbose) {
        configureLogger({ minLevel: "debug" });
      } else {
        configureLogger({ silent: true });
      }

      // Batch processing for multiple objects
      if (options.batch || objectNames.includes(",")) {
        const objectList = objectNames.split(",").map((s) => s.trim());
        const results = await Promise.all(
          objectList.map(async (objName) => {
            try {
              const rules = await getValidationRules(
                objName,
                !options.all,
                buildConnectionConfig(options),
              );
              return {
                objectName: objName,
                success: true,
                rules: rules,
              };
            } catch (error) {
              return {
                objectName: objName,
                success: false,
                error: error instanceof Error ? error.message : String(error),
              };
            }
          }),
        );
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      // Single object processing
      const rules = await getValidationRules(
        objectNames,
        !options.all,
        buildConnectionConfig(options),
      );
      console.log(JSON.stringify(rules, null, 2));
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Flows command
program
  .command("flows")
  .description("List flows")
  .option("--object <name>", "Filter by trigger object")
  .option("--all", "Include inactive flows")
  .option("-o, --org <alias>", "Org alias (overrides role-based config)")
  .option(
    "-r, --role <role>",
    "Org role: primary|legacy|modern|legacyData|legacyMetadata|modernData|modernMetadata|dataCloud",
  )
  .option("--json", "Output as JSON (default)")
  .option("-v, --verbose", "Verbose output")
  .action(async (options) => {
    try {
      // Silence logs by default for clean JSON output, unless verbose
      if (options.verbose) {
        configureLogger({ minLevel: "debug" });
      } else {
        configureLogger({ silent: true });
      }

      const flows = await getFlows(options.object, !options.all, buildConnectionConfig(options));
      console.log(JSON.stringify(flows, null, 2));
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Custom objects command
program
  .command("custom-objects")
  .description("List custom objects")
  .option("-o, --org <alias>", "Org alias (overrides role-based config)")
  .option(
    "-r, --role <role>",
    "Org role: primary|legacy|modern|legacyData|legacyMetadata|modernData|modernMetadata|dataCloud",
  )
  .option("--json", "Output as JSON (default)")
  .option("-v, --verbose", "Verbose output")
  .action(async (options) => {
    try {
      // Silence logs by default for clean JSON output, unless verbose
      if (options.verbose) {
        configureLogger({ minLevel: "debug" });
      } else {
        configureLogger({ silent: true });
      }

      const objects = await getCustomObjects(buildConnectionConfig(options));
      console.log(JSON.stringify(objects, null, 2));
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// --- Org Management Commands ---

import { createInterface } from "readline";
import {
  loadOrgConfig,
  isOrgConfigured,
  getResolvedRoleMap,
  saveOrgConfig,
  validateOrgConfig,
  VALID_ROLES,
} from "../src/lib/sfOrgResolver.js";
import { listSfOrgs, validateSfAuth } from "../src/lib/authSalesforceCli.js";
import type { SfOrgsConfig, SfOrgEntry, SfOrgDesignation } from "../src/types/configTypes.js";

/** Prompt user for input via readline */
function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/** Prompt user to select from a list, with optional default */
async function promptSelect(
  question: string,
  choices: string[],
  defaultChoice?: string,
): Promise<string> {
  console.error(`\n${question}`);
  choices.forEach((c, i) => {
    const marker = c === defaultChoice ? " (default)" : "";
    console.error(`  ${i + 1}. ${c}${marker}`);
  });

  const defaultIdx = defaultChoice ? choices.indexOf(defaultChoice) + 1 : undefined;
  const hint = defaultIdx ? ` [${defaultIdx}]` : "";
  const answer = await prompt(`Select${hint}: `);

  if (!answer && defaultIdx) return defaultChoice!;

  const idx = parseInt(answer, 10);
  if (idx >= 1 && idx <= choices.length) return choices[idx - 1]!;

  // Try matching by name
  const match = choices.find((c) => c.toLowerCase() === answer.toLowerCase());
  if (match) return match;

  const fallback = defaultChoice ?? choices[0]!;
  console.error(`Invalid selection. Using ${fallback}.`);
  return fallback;
}

// org-setup command
program
  .command("org-setup")
  .description("Interactive multi-org Salesforce configuration")
  .action(async () => {
    try {
      configureLogger({ silent: true });
      console.error("=== Salesforce Org Setup ===\n");

      // 1. List authenticated orgs
      const orgs = await listSfOrgs();
      if (orgs.length === 0) {
        console.error("No authenticated Salesforce orgs found.");
        console.error("Run: sf org login web -a <alias>");
        process.exit(1);
      }

      const aliases = orgs.flatMap((o) => (o.aliases.length > 0 ? o.aliases : [o.username]));
      console.error("Authenticated orgs:");
      orgs.forEach((o) => {
        const aliasStr = o.aliases.length > 0 ? o.aliases.join(", ") : "(no alias)";
        const defaultMarker = o.isDefaultUsername ? " [default]" : "";
        console.error(`  - ${aliasStr} | ${o.username} | ${o.instanceUrl}${defaultMarker}`);
      });

      // 2. Single or multi-org?
      const orgCount = await prompt("\nHow many Salesforce orgs do you work with? (1/2+): ");
      const isMultiOrg = orgCount.startsWith("2") || orgCount.toLowerCase().includes("multi");

      const config: SfOrgsConfig = {
        version: "1.0",
        configured: true,
        configured_at: new Date().toISOString(),
        orgs: {},
        roles: { primary: "" },
      };

      if (!isMultiOrg) {
        // Single-org setup
        const orgAlias = await promptSelect("Which org?", aliases);
        const entry: SfOrgEntry = { alias: orgAlias };
        config.orgs[orgAlias] = entry;
        // Assign all roles to the single org
        for (const role of VALID_ROLES) {
          (config.roles as Record<string, string>)[role] = orgAlias;
        }
      } else {
        // Multi-org setup — explicit per-role questions
        const legacyAlias = await promptSelect("Which org is your LEGACY org?", aliases);
        const modernAlias = await promptSelect(
          "Which org is your MODERN org?",
          aliases,
          aliases.find((a) => a !== legacyAlias),
        );

        config.orgs[legacyAlias] = {
          alias: legacyAlias,
          designation: "legacy" as SfOrgDesignation,
          description: "Legacy CRM org",
        };
        config.orgs[modernAlias] = {
          alias: modernAlias,
          designation: "modern" as SfOrgDesignation,
          description: "Modern/target CRM org",
        };

        config.roles.legacy = legacyAlias;
        config.roles.modern = modernAlias;

        // Per-role questions with smart defaults
        config.roles.legacyData = await promptSelect(
          "Which org for LEGACY DATA queries (SOQL)?",
          aliases,
          legacyAlias,
        );
        config.roles.legacyMetadata = await promptSelect(
          "Which org for LEGACY METADATA inspection?",
          aliases,
          legacyAlias,
        );
        config.roles.modernData = await promptSelect(
          "Which org for MODERN DATA queries (SOQL)?",
          aliases,
          modernAlias,
        );
        config.roles.modernMetadata = await promptSelect(
          "Which org for MODERN METADATA inspection?",
          aliases,
          modernAlias,
        );
        config.roles.dataCloud = await promptSelect(
          "Which org for DATA CLOUD?",
          aliases,
          modernAlias,
        );
        config.roles.primary = await promptSelect(
          "Which org is the PRIMARY (default for unspecified operations)?",
          aliases,
          modernAlias,
        );
      }

      // Save config
      saveOrgConfig(config);
      console.error("\nConfiguration saved to platforms/crm/config/crm-orgs.json");

      // Validate
      console.error("\nValidating org connections...");
      const results = await validateOrgConfig(validateSfAuth);
      for (const r of results) {
        const status = r.success ? "OK" : `FAILED: ${r.error}`;
        console.error(`  ${r.alias}: ${status}`);
      }

      const allPassed = results.every((r) => r.success);
      if (allPassed) {
        console.error("\nAll orgs validated successfully.");
      } else {
        console.error(
          "\nSome orgs failed validation. Run `sf org login web -a <alias>` to re-authenticate.",
        );
      }

      // Output config as JSON to stdout
      console.log(JSON.stringify(config, null, 2));
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// org-status command
program
  .command("org-status")
  .description("Show current org configuration and role mappings")
  .action(async () => {
    try {
      configureLogger({ silent: true });

      if (!isOrgConfigured()) {
        console.error(
          "No org configuration found. Run: npx --prefix core/scripts/workflow crm-tools org-setup",
        );
        process.exit(1);
      }

      const config = loadOrgConfig()!;
      const roleMap = getResolvedRoleMap();

      const output = {
        configured: config.configured,
        configured_at: config.configured_at,
        orgs: config.orgs,
        resolved_roles: roleMap,
      };

      console.log(JSON.stringify(output, null, 2));
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// org-validate command
program
  .command("org-validate")
  .description("Validate all configured orgs are authenticated")
  .action(async () => {
    try {
      configureLogger({ silent: true });

      if (!isOrgConfigured()) {
        console.error(
          "No org configuration found. Run: npx --prefix core/scripts/workflow crm-tools org-setup",
        );
        process.exit(1);
      }

      const results = await validateOrgConfig(validateSfAuth);
      console.log(JSON.stringify(results, null, 2));

      const allPassed = results.every((r) => r.success);
      if (!allPassed) {
        process.exit(1);
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
