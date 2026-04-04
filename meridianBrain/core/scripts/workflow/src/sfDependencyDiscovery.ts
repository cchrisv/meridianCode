/**
 * Salesforce Dependency Discovery
 * Discovers metadata dependencies for a given component
 */

import { type SfConnectionConfig } from "./sfClient.js";
import { executeToolingQuery } from "./sfQueryExecutor.js";
import { detectCycles } from "./sfDependencyTraverser.js";
import { enrichWithUsagePills } from "./sfDependencyEnrichment.js";
import { logInfo, logDebug, logWarn, createTimer } from "./lib/loggerStructured.js";
import { validate, DiscoverDependenciesOptionsSchema } from "./lib/validationSchemas.js";
import type {
  DependencyNode,
  DependencyEdge,
  DependencyGraph,
  DependencyGraphMetadata,
  DiscoverDependenciesOptions,
  DiscoveryResult,
  MetadataType,
  DependencyRelationship,
} from "./types/sfDependencyTypes.js";

/**
 * Discover all dependencies for a metadata component
 *
 * @param options - Discovery options
 * @param config - Connection config
 * @returns Discovery result with graph and pills
 */
export async function discoverDependencies(
  options: DiscoverDependenciesOptions,
  config?: SfConnectionConfig,
): Promise<DiscoveryResult> {
  const timer = createTimer();
  const validatedOptions = validate(DiscoverDependenciesOptionsSchema, options);

  const { rootType, rootName, maxDepth = 3 } = validatedOptions;

  logInfo(`Discovering dependencies for ${rootType}:${rootName}`, { maxDepth });

  const nodes = new Map<string, DependencyNode>();
  const edges: DependencyEdge[] = [];
  const warnings: string[] = [];

  // Create root node
  const rootId = createNodeId(rootType, rootName);
  const rootNode: DependencyNode = {
    id: rootId,
    name: rootName,
    type: rootType,
    apiName: rootName,
    depth: 0,
    isLeaf: false,
  };
  nodes.set(rootId, rootNode);

  // Discover dependencies based on type
  try {
    await discoverForType(
      rootType,
      rootName,
      0,
      maxDepth,
      nodes,
      edges,
      warnings,
      validatedOptions,
      config,
    );
  } catch (error) {
    warnings.push(
      `Error discovering dependencies: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Detect cycles
  const cycleResult = detectCycles(nodes, edges, rootId);
  if (cycleResult.hasCycles) {
    logWarn(`Circular dependencies detected`, { cycles: cycleResult.cycles });

    // Mark circular nodes
    for (const cycle of cycleResult.cycles) {
      for (const nodeId of cycle) {
        const node = nodes.get(nodeId);
        if (node) {
          node.isCircular = true;
        }
      }
    }
  }

  // Build graph metadata
  const metadata: DependencyGraphMetadata = {
    generatedAt: new Date().toISOString(),
    rootType,
    rootName,
    maxDepth,
    nodeCount: nodes.size,
    edgeCount: edges.length,
    hasCircularDependencies: cycleResult.hasCycles,
    circularPaths: cycleResult.hasCycles ? cycleResult.cycles : undefined,
  };

  const graph: DependencyGraph = {
    nodes,
    edges,
    rootId,
    metadata,
  };

  // Enrich with usage pills
  const pills = await enrichWithUsagePills(graph, config);

  const executionTime = timer.elapsed();
  logInfo(`Dependency discovery complete`, {
    nodes: nodes.size,
    edges: edges.length,
    executionTime,
  });

  return {
    graph,
    pills,
    warnings,
    executionTime,
  };
}

/**
 * Create a unique node ID
 */
function createNodeId(type: MetadataType, name: string): string {
  return `${type}:${name}`;
}

/**
 * Discover dependencies for a specific metadata type
 */
async function discoverForType(
  type: MetadataType,
  name: string,
  currentDepth: number,
  maxDepth: number,
  nodes: Map<string, DependencyNode>,
  edges: DependencyEdge[],
  warnings: string[],
  options: DiscoverDependenciesOptions,
  config?: SfConnectionConfig,
): Promise<void> {
  if (currentDepth >= maxDepth) {
    return;
  }

  logDebug(`Discovering ${type}:${name} at depth ${currentDepth}`);

  switch (type) {
    case "CustomObject":
      await discoverCustomObjectDependencies(
        name,
        currentDepth,
        maxDepth,
        nodes,
        edges,
        warnings,
        options,
        config,
      );
      break;
    case "CustomField":
      await discoverCustomFieldDependencies(
        name,
        currentDepth,
        maxDepth,
        nodes,
        edges,
        warnings,
        options,
        config,
      );
      break;
    case "ApexClass":
      await discoverApexClassDependencies(
        name,
        currentDepth,
        maxDepth,
        nodes,
        edges,
        warnings,
        options,
        config,
      );
      break;
    case "ApexTrigger":
      await discoverApexTriggerDependencies(
        name,
        currentDepth,
        maxDepth,
        nodes,
        edges,
        warnings,
        options,
        config,
      );
      break;
    case "Flow":
      await discoverFlowDependencies(
        name,
        currentDepth,
        maxDepth,
        nodes,
        edges,
        warnings,
        options,
        config,
      );
      break;
    default:
      logDebug(`No specific discovery for type ${type}`);
  }
}

/**
 * Discover dependencies for a CustomObject
 */
async function discoverCustomObjectDependencies(
  objectName: string,
  currentDepth: number,
  maxDepth: number,
  nodes: Map<string, DependencyNode>,
  edges: DependencyEdge[],
  warnings: string[],
  options: DiscoverDependenciesOptions,
  config?: SfConnectionConfig,
): Promise<void> {
  const sourceId = createNodeId("CustomObject", objectName);

  // Get custom fields (filter by __c suffix since IsCustom isn't available on FieldDefinition)
  const fieldsQuery = `
    SELECT QualifiedApiName, DataType, ReferenceTo, RelationshipName
    FROM FieldDefinition
    WHERE EntityDefinition.QualifiedApiName = '${objectName}'
    AND QualifiedApiName LIKE '%__c'
  `;

  try {
    const fields = await executeToolingQuery<{
      QualifiedApiName: string;
      DataType: string;
      ReferenceTo: { referenceTo: string[] } | null;
      RelationshipName: string | null;
    }>(fieldsQuery, config);

    for (const field of fields.records) {
      const fieldId = createNodeId("CustomField", `${objectName}.${field.QualifiedApiName}`);

      if (!nodes.has(fieldId)) {
        nodes.set(fieldId, {
          id: fieldId,
          name: field.QualifiedApiName,
          type: "CustomField",
          apiName: `${objectName}.${field.QualifiedApiName}`,
          depth: currentDepth + 1,
          isLeaf: true,
          parentId: sourceId,
        });
      }

      edges.push({
        sourceId,
        targetId: fieldId,
        relationshipType: "contains",
      });

      // Track lookup relationships
      if (field.ReferenceTo?.referenceTo && field.ReferenceTo.referenceTo.length > 0) {
        for (const refTo of field.ReferenceTo.referenceTo) {
          if (!options.includeStandardObjects && !refTo.endsWith("__c")) {
            continue;
          }

          const refId = createNodeId("CustomObject", refTo);

          if (!nodes.has(refId)) {
            nodes.set(refId, {
              id: refId,
              name: refTo,
              type: "CustomObject",
              apiName: refTo,
              depth: currentDepth + 2,
              isLeaf: currentDepth + 2 >= maxDepth,
            });

            // Recursively discover if not at max depth
            if (currentDepth + 2 < maxDepth) {
              await discoverForType(
                "CustomObject",
                refTo,
                currentDepth + 2,
                maxDepth,
                nodes,
                edges,
                warnings,
                options,
                config,
              );
            }
          }

          const relType: DependencyRelationship =
            field.DataType === "MasterDetail" ? "masterDetail" : "lookupTo";
          edges.push({
            sourceId: fieldId,
            targetId: refId,
            relationshipType: relType,
          });
        }
      }
    }
  } catch (error) {
    warnings.push(
      `Error querying fields for ${objectName}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Get triggers
  const triggersQuery = `
    SELECT Name FROM ApexTrigger WHERE TableEnumOrId = '${objectName}'
  `;

  try {
    const triggers = await executeToolingQuery<{ Name: string }>(triggersQuery, config);

    for (const trigger of triggers.records) {
      const triggerId = createNodeId("ApexTrigger", trigger.Name);

      if (!nodes.has(triggerId)) {
        nodes.set(triggerId, {
          id: triggerId,
          name: trigger.Name,
          type: "ApexTrigger",
          apiName: trigger.Name,
          depth: currentDepth + 1,
          isLeaf: currentDepth + 1 >= maxDepth,
          parentId: sourceId,
        });
      }

      edges.push({
        sourceId,
        targetId: triggerId,
        relationshipType: "triggers",
      });
    }
  } catch (error) {
    warnings.push(
      `Error querying triggers for ${objectName}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Get validation rules
  const validationQuery = `
    SELECT ValidationName FROM ValidationRule 
    WHERE EntityDefinition.QualifiedApiName = '${objectName}' AND Active = true
  `;

  try {
    const validations = await executeToolingQuery<{ ValidationName: string }>(
      validationQuery,
      config,
    );

    for (const rule of validations.records) {
      const ruleId = createNodeId("ValidationRule", `${objectName}.${rule.ValidationName}`);

      if (!nodes.has(ruleId)) {
        nodes.set(ruleId, {
          id: ruleId,
          name: rule.ValidationName,
          type: "ValidationRule",
          apiName: `${objectName}.${rule.ValidationName}`,
          depth: currentDepth + 1,
          isLeaf: true,
          parentId: sourceId,
        });
      }

      edges.push({
        sourceId,
        targetId: ruleId,
        relationshipType: "contains",
      });
    }
  } catch (error) {
    warnings.push(
      `Error querying validation rules for ${objectName}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Discover dependencies for a CustomField
 */
async function discoverCustomFieldDependencies(
  fieldName: string,
  _currentDepth: number,
  _maxDepth: number,
  _nodes: Map<string, DependencyNode>,
  _edges: DependencyEdge[],
  _warnings: string[],
  _options: DiscoverDependenciesOptions,
  _config?: SfConnectionConfig,
): Promise<void> {
  // Field dependencies are typically handled through the parent object
  // This would analyze formula fields, lookup references, etc.
  logDebug(`Field dependency discovery for ${fieldName} - handled via parent object`);
}

/**
 * Discover dependencies for an ApexClass
 */
async function discoverApexClassDependencies(
  className: string,
  currentDepth: number,
  maxDepth: number,
  nodes: Map<string, DependencyNode>,
  edges: DependencyEdge[],
  warnings: string[],
  _options: DiscoverDependenciesOptions,
  config?: SfConnectionConfig,
): Promise<void> {
  const sourceId = createNodeId("ApexClass", className);

  // Query for class dependencies using SymbolTable
  const query = `
    SELECT Id, Name, SymbolTable 
    FROM ApexClass 
    WHERE Name = '${className}'
  `;

  try {
    const result = await executeToolingQuery<{
      Id: string;
      Name: string;
      SymbolTable: {
        externalReferences?: Array<{ name: string; namespace: string }>;
      } | null;
    }>(query, config);

    if (result.records.length > 0 && result.records[0]?.SymbolTable?.externalReferences) {
      for (const ref of result.records[0].SymbolTable.externalReferences) {
        // Skip standard references
        if (!options.includeStandardObjects && !ref.name.endsWith("__c")) {
          continue;
        }

        const refId = createNodeId("ApexClass", ref.name);

        if (!nodes.has(refId) && ref.name !== className) {
          nodes.set(refId, {
            id: refId,
            name: ref.name,
            type: "ApexClass",
            apiName: ref.name,
            namespace: ref.namespace || undefined,
            depth: currentDepth + 1,
            isLeaf: currentDepth + 1 >= maxDepth,
          });

          edges.push({
            sourceId,
            targetId: refId,
            relationshipType: "references",
          });
        }
      }
    }
  } catch (error) {
    warnings.push(
      `Error querying Apex class ${className}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Discover dependencies for an ApexTrigger
 */
async function discoverApexTriggerDependencies(
  triggerName: string,
  currentDepth: number,
  maxDepth: number,
  nodes: Map<string, DependencyNode>,
  edges: DependencyEdge[],
  warnings: string[],
  _options: DiscoverDependenciesOptions,
  config?: SfConnectionConfig,
): Promise<void> {
  const sourceId = createNodeId("ApexTrigger", triggerName);

  // Get the object the trigger is on
  const query = `
    SELECT TableEnumOrId FROM ApexTrigger WHERE Name = '${triggerName}'
  `;

  try {
    const result = await executeToolingQuery<{ TableEnumOrId: string }>(query, config);

    if (result.records.length > 0 && result.records[0]) {
      const objectName = result.records[0].TableEnumOrId;
      const objectId = createNodeId("CustomObject", objectName);

      if (!nodes.has(objectId)) {
        nodes.set(objectId, {
          id: objectId,
          name: objectName,
          type: "CustomObject",
          apiName: objectName,
          depth: currentDepth + 1,
          isLeaf: currentDepth + 1 >= maxDepth,
        });
      }

      edges.push({
        sourceId,
        targetId: objectId,
        relationshipType: "triggers",
      });
    }
  } catch (error) {
    warnings.push(
      `Error querying trigger ${triggerName}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Discover dependencies for a Flow
 */
async function discoverFlowDependencies(
  flowName: string,
  currentDepth: number,
  maxDepth: number,
  nodes: Map<string, DependencyNode>,
  edges: DependencyEdge[],
  warnings: string[],
  _options: DiscoverDependenciesOptions,
  config?: SfConnectionConfig,
): Promise<void> {
  const sourceId = createNodeId("Flow", flowName);

  // Get the object the flow triggers on
  const query = `
    SELECT TriggerObjectOrEvent FROM Flow 
    WHERE DeveloperName = '${flowName}' AND IsActive = true
  `;

  try {
    const result = await executeToolingQuery<{ TriggerObjectOrEvent: string | null }>(
      query,
      config,
    );

    if (result.records.length > 0 && result.records[0]?.TriggerObjectOrEvent) {
      const objectName = result.records[0].TriggerObjectOrEvent;
      const objectId = createNodeId("CustomObject", objectName);

      if (!nodes.has(objectId)) {
        nodes.set(objectId, {
          id: objectId,
          name: objectName,
          type: "CustomObject",
          apiName: objectName,
          depth: currentDepth + 1,
          isLeaf: currentDepth + 1 >= maxDepth,
        });
      }

      edges.push({
        sourceId,
        targetId: objectId,
        relationshipType: "flowReference",
      });
    }
  } catch (error) {
    warnings.push(
      `Error querying flow ${flowName}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Export graph to JSON format for visualization
 */
export function exportGraphToJson(graph: DependencyGraph): string {
  const nodes = Array.from(graph.nodes.values());
  return JSON.stringify(
    {
      nodes,
      edges: graph.edges,
      metadata: graph.metadata,
    },
    null,
    2,
  );
}

/**
 * Export graph to DOT format for Graphviz
 */
export function exportGraphToDot(graph: DependencyGraph): string {
  const lines: string[] = ["digraph Dependencies {"];
  lines.push("  rankdir=LR;");
  lines.push("  node [shape=box];");
  lines.push("");

  // Add nodes
  for (const node of graph.nodes.values()) {
    const label = `${node.type}\\n${node.name}`;
    const color = node.isCircular ? "red" : "black";
    lines.push(`  "${node.id}" [label="${label}" color="${color}"];`);
  }

  lines.push("");

  // Add edges
  for (const edge of graph.edges) {
    lines.push(`  "${edge.sourceId}" -> "${edge.targetId}" [label="${edge.relationshipType}"];`);
  }

  lines.push("}");
  return lines.join("\n");
}
