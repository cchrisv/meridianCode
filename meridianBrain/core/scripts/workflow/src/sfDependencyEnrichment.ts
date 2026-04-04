/**
 * Salesforce Dependency Enrichment
 * Enriches dependency graphs with usage information and pills
 */

import { executeToolingQuery } from "./sfQueryExecutor.js";
import { logInfo, logDebug, createTimer } from "./lib/loggerStructured.js";
import type { SfConnectionConfig } from "./sfClient.js";
import type {
  DependencyGraph,
  UsagePill,
  UsagePillType,
  UsageSeverity,
  EnrichmentOptions,
} from "./types/sfDependencyTypes.js";

/**
 * Default enrichment options
 */
const DEFAULT_ENRICHMENT_OPTIONS: EnrichmentOptions = {
  includeApexUsage: true,
  includeFlowUsage: true,
  includeValidationUsage: true,
  includeWorkflowUsage: true,
  includeFormulaUsage: false,
  includeLayoutUsage: false,
  includeReportUsage: false,
};

/**
 * Enrich a dependency graph with usage pills
 *
 * @param graph - Dependency graph to enrich
 * @param config - Connection config
 * @param options - Enrichment options
 * @returns Array of usage pills
 */
export async function enrichWithUsagePills(
  graph: DependencyGraph,
  config?: SfConnectionConfig,
  options: EnrichmentOptions = DEFAULT_ENRICHMENT_OPTIONS,
): Promise<UsagePill[]> {
  const timer = createTimer();
  const pills: UsagePill[] = [];

  logInfo("Enriching graph with usage pills");

  // Collect all field and object names for querying
  const objectNames = new Set<string>();
  const fieldNames = new Set<string>();

  for (const node of graph.nodes.values()) {
    if (node.type === "CustomObject") {
      objectNames.add(node.apiName);
    } else if (node.type === "CustomField") {
      fieldNames.add(node.apiName);
    }
  }

  // Enrich with Apex usage
  if (options.includeApexUsage && (objectNames.size > 0 || fieldNames.size > 0)) {
    const apexPills = await analyzeApexUsage(objectNames, fieldNames, config);
    pills.push(...apexPills);
  }

  // Enrich with Flow usage
  if (options.includeFlowUsage && objectNames.size > 0) {
    const flowPills = await analyzeFlowUsage(objectNames, config);
    pills.push(...flowPills);
  }

  // Enrich with Validation Rule usage
  if (options.includeValidationUsage && fieldNames.size > 0) {
    const validationPills = await analyzeValidationUsage(fieldNames, config);
    pills.push(...validationPills);
  }

  logInfo(`Created ${pills.length} usage pills`);
  timer.log("enrichWithUsagePills");

  return pills;
}

/**
 * Analyze Apex code for field/object usage
 */
async function analyzeApexUsage(
  objectNames: Set<string>,
  fieldNames: Set<string>,
  config?: SfConnectionConfig,
): Promise<UsagePill[]> {
  const pills: UsagePill[] = [];

  if (objectNames.size === 0 && fieldNames.size === 0) {
    return pills;
  }

  logDebug("Analyzing Apex usage");

  // Query Apex classes that reference these objects via MetadataComponentDependency
  for (const objectName of objectNames) {
    try {
      // Use MetadataComponentDependency to find actual references
      const query = `
        SELECT MetadataComponentName, MetadataComponentType
        FROM MetadataComponentDependency
        WHERE RefMetadataComponentName = '${objectName}'
        AND MetadataComponentType = 'ApexClass'
      `;

      const result = await executeToolingQuery<{
        MetadataComponentName: string;
        MetadataComponentType: string;
      }>(query, config);

      if (result.records.length > 0) {
        const severity: UsageSeverity = result.records.length > 10 ? "warning" : "info";
        pills.push(
          createPill({
            type: "apex_usage",
            label: `${objectName} Apex Usage`,
            description: `${result.records.length} Apex class(es) reference this object`,
            severity,
            affectedComponents: result.records.slice(0, 10).map((r) => r.MetadataComponentName),
            recommendation:
              severity === "warning"
                ? "High Apex coupling — review classes for direct object references before making schema changes"
                : "Review Apex classes for direct object references before making schema changes",
          }),
        );
      }
    } catch (error) {
      // MetadataComponentDependency may not be available in all orgs; fall back to count-only pill
      logDebug(
        `MetadataComponentDependency not available for ${objectName}, skipping Apex usage enrichment: ${error}`,
      );
    }
  }

  return pills;
}

/**
 * Analyze Flows for object usage
 */
async function analyzeFlowUsage(
  objectNames: Set<string>,
  config?: SfConnectionConfig,
): Promise<UsagePill[]> {
  const pills: UsagePill[] = [];

  logDebug("Analyzing Flow usage");

  for (const objectName of objectNames) {
    try {
      const query = `
        SELECT Id, MasterLabel, ProcessType, Status
        FROM Flow
        WHERE TriggerObjectOrEvent = '${objectName}'
        AND IsActive = true
      `;

      const result = await executeToolingQuery<{
        Id: string;
        MasterLabel: string;
        ProcessType: string;
        Status: string;
      }>(query, config);

      if (result.records.length > 0) {
        const severity: UsageSeverity = result.records.length > 3 ? "warning" : "info";

        pills.push(
          createPill({
            type: "flow_usage",
            label: `${objectName} Flow Usage`,
            description: `${result.records.length} active Flow(s) trigger on this object`,
            severity,
            affectedComponents: result.records.map((r) => r.MasterLabel),
            recommendation:
              severity === "warning"
                ? "Multiple flows may cause performance issues or conflicts"
                : "Review flows before making changes to this object",
          }),
        );
      }
    } catch (error) {
      logDebug(`Error analyzing Flows for ${objectName}: ${error}`);
    }
  }

  return pills;
}

/**
 * Analyze Validation Rules for field usage
 */
async function analyzeValidationUsage(
  fieldNames: Set<string>,
  config?: SfConnectionConfig,
): Promise<UsagePill[]> {
  const pills: UsagePill[] = [];

  logDebug("Analyzing Validation Rule usage");

  // Group fields by object
  const fieldsByObject = new Map<string, string[]>();

  for (const fieldName of fieldNames) {
    const parts = fieldName.split(".");
    if (parts.length === 2) {
      const objectName = parts[0];
      const field = parts[1];

      if (!fieldsByObject.has(objectName!)) {
        fieldsByObject.set(objectName!, []);
      }
      fieldsByObject.get(objectName!)!.push(field!);
    }
  }

  for (const [objectName, _fields] of fieldsByObject) {
    try {
      const query = `
        SELECT Id, ValidationName, ErrorMessage, Active
        FROM ValidationRule
        WHERE EntityDefinition.QualifiedApiName = '${objectName}'
        AND Active = true
      `;

      const result = await executeToolingQuery<{
        Id: string;
        ValidationName: string;
        ErrorMessage: string;
        Active: boolean;
      }>(query, config);

      if (result.records.length > 0) {
        pills.push(
          createPill({
            type: "validation_usage",
            label: `${objectName} Validation Rules`,
            description: `${result.records.length} active validation rule(s) on this object`,
            severity: "info",
            affectedComponents: result.records.map((r) => r.ValidationName),
            recommendation: "Review validation rules when modifying fields on this object",
          }),
        );
      }
    } catch (error) {
      logDebug(`Error analyzing Validation Rules for ${objectName}: ${error}`);
    }
  }

  return pills;
}

/**
 * Create a usage pill with a unique ID
 */
export function createPill(options: Omit<UsagePill, "id">): UsagePill {
  return {
    id: `pill_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    ...options,
  };
}

/**
 * Filter pills by severity
 */
export function filterPillsBySeverity(pills: UsagePill[], minSeverity: UsageSeverity): UsagePill[] {
  const severityOrder: Record<UsageSeverity, number> = {
    info: 0,
    warning: 1,
    critical: 2,
  };

  const minLevel = severityOrder[minSeverity];
  return pills.filter((p) => severityOrder[p.severity] >= minLevel);
}

/**
 * Filter pills by type
 */
export function filterPillsByType(pills: UsagePill[], types: UsagePillType[]): UsagePill[] {
  return pills.filter((p) => types.includes(p.type));
}

/**
 * Group pills by severity
 */
export function groupPillsBySeverity(pills: UsagePill[]): Record<UsageSeverity, UsagePill[]> {
  const result: Record<UsageSeverity, UsagePill[]> = {
    info: [],
    warning: [],
    critical: [],
  };

  for (const pill of pills) {
    result[pill.severity].push(pill);
  }

  return result;
}

/**
 * Get summary of pills
 */
export function getPillsSummary(pills: UsagePill[]): PillsSummary {
  const grouped = groupPillsBySeverity(pills);

  return {
    total: pills.length,
    byCategory: {
      info: grouped.info.length,
      warning: grouped.warning.length,
      critical: grouped.critical.length,
    },
    topRecommendations: pills
      .filter((p) => p.recommendation)
      .slice(0, 5)
      .map((p) => p.recommendation!),
  };
}

/**
 * Pills summary interface
 */
export interface PillsSummary {
  total: number;
  byCategory: Record<UsageSeverity, number>;
  topRecommendations: string[];
}

/**
 * Format pills for display
 */
export function formatPillsForDisplay(pills: UsagePill[]): string {
  const lines: string[] = [];
  const grouped = groupPillsBySeverity(pills);

  if (grouped.critical.length > 0) {
    lines.push("🔴 CRITICAL:");
    for (const pill of grouped.critical) {
      lines.push(`  - ${pill.label}: ${pill.description}`);
    }
    lines.push("");
  }

  if (grouped.warning.length > 0) {
    lines.push("🟡 WARNINGS:");
    for (const pill of grouped.warning) {
      lines.push(`  - ${pill.label}: ${pill.description}`);
    }
    lines.push("");
  }

  if (grouped.info.length > 0) {
    lines.push("ℹ️ INFO:");
    for (const pill of grouped.info) {
      lines.push(`  - ${pill.label}: ${pill.description}`);
    }
  }

  return lines.join("\n");
}
