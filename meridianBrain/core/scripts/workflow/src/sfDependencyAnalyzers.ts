/**
 * Salesforce Dependency Analyzers
 * Specialized analyzers for different metadata types
 */

import { executeToolingQuery, executeSoqlQuery } from "./sfQueryExecutor.js";
import { logInfo, logDebug, logWarn, createTimer } from "./lib/loggerStructured.js";
import type { SfConnectionConfig } from "./sfClient.js";
import type { DependencyNode, DependencyEdge } from "./types/sfDependencyTypes.js";

/**
 * Analysis result for a specific component
 */
export interface AnalysisResult {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  warnings: string[];
}

/**
 * Analyze standard field references in custom objects
 */
export async function analyzeStandardFields(
  objectName: string,
  config?: SfConnectionConfig,
): Promise<AnalysisResult> {
  const timer = createTimer();
  const nodes: DependencyNode[] = [];
  const edges: DependencyEdge[] = [];
  const warnings: string[] = [];

  logInfo(`Analyzing standard fields for ${objectName}`);

  try {
    const query = `
      SELECT QualifiedApiName, DataType, Label, IsCompound, IsNillable
      FROM FieldDefinition
      WHERE EntityDefinition.QualifiedApiName = '${objectName}'
      AND IsCustom = false
    `;

    const result = await executeToolingQuery<{
      QualifiedApiName: string;
      DataType: string;
      Label: string;
      IsCompound: boolean;
      IsNillable: boolean;
    }>(query, config);

    for (const field of result.records) {
      const nodeId = `StandardField:${objectName}.${field.QualifiedApiName}`;

      nodes.push({
        id: nodeId,
        name: field.QualifiedApiName,
        type: "CustomField", // Using CustomField type for consistency
        apiName: `${objectName}.${field.QualifiedApiName}`,
        depth: 1,
        isLeaf: true,
        metadata: {
          dataType: field.DataType,
          label: field.Label,
          isCompound: field.IsCompound,
          isNillable: field.IsNillable,
          isStandard: true,
        },
      });

      edges.push({
        sourceId: `CustomObject:${objectName}`,
        targetId: nodeId,
        relationshipType: "contains",
      });
    }

    logInfo(`Found ${nodes.length} standard fields for ${objectName}`);
  } catch (error) {
    const msg = `Error analyzing standard fields for ${objectName}: ${error instanceof Error ? error.message : String(error)}`;
    logWarn(msg);
    warnings.push(msg);
  }

  timer.log(`analyzeStandardFields(${objectName})`);
  return { nodes, edges, warnings };
}

/**
 * Analyze Custom Metadata Type dependencies
 */
export async function analyzeCustomMetadata(
  cmtName: string,
  config?: SfConnectionConfig,
): Promise<AnalysisResult> {
  const timer = createTimer();
  const nodes: DependencyNode[] = [];
  const edges: DependencyEdge[] = [];
  const warnings: string[] = [];

  logInfo(`Analyzing Custom Metadata Type: ${cmtName}`);

  try {
    // Get the CMT definition
    const entityQuery = `
      SELECT QualifiedApiName, DeveloperName, MasterLabel, KeyPrefix
      FROM EntityDefinition
      WHERE QualifiedApiName = '${cmtName}'
    `;

    const entityResult = await executeToolingQuery<{
      QualifiedApiName: string;
      DeveloperName: string;
      MasterLabel: string;
      KeyPrefix: string;
    }>(entityQuery, config);

    if (entityResult.records.length === 0) {
      warnings.push(`Custom Metadata Type ${cmtName} not found`);
      return { nodes, edges, warnings };
    }

    const entity = entityResult.records[0]!;
    const rootId = `CustomMetadataType:${cmtName}`;

    nodes.push({
      id: rootId,
      name: entity.DeveloperName,
      type: "CustomMetadataType",
      apiName: cmtName,
      depth: 0,
      isLeaf: false,
      metadata: {
        label: entity.MasterLabel,
        keyPrefix: entity.KeyPrefix,
      },
    });

    // Get fields
    const fieldsQuery = `
      SELECT QualifiedApiName, DataType, Label
      FROM FieldDefinition
      WHERE EntityDefinition.QualifiedApiName = '${cmtName}'
      AND IsCustom = true
    `;

    const fieldsResult = await executeToolingQuery<{
      QualifiedApiName: string;
      DataType: string;
      Label: string;
    }>(fieldsQuery, config);

    for (const field of fieldsResult.records) {
      const fieldId = `CustomField:${cmtName}.${field.QualifiedApiName}`;

      nodes.push({
        id: fieldId,
        name: field.QualifiedApiName,
        type: "CustomField",
        apiName: `${cmtName}.${field.QualifiedApiName}`,
        depth: 1,
        isLeaf: true,
        parentId: rootId,
        metadata: {
          dataType: field.DataType,
          label: field.Label,
        },
      });

      edges.push({
        sourceId: rootId,
        targetId: fieldId,
        relationshipType: "contains",
      });
    }

    // Get records count
    try {
      const recordsQuery = `SELECT COUNT() FROM ${cmtName}`;
      const recordsResult = await executeSoqlQuery<{ expr0: number }>(recordsQuery, config);

      if (recordsResult.totalSize > 0) {
        logDebug(`${cmtName} has ${recordsResult.totalSize} records`);
      }
    } catch {
      // CMT might not be queryable in standard SOQL
      logDebug(`Could not query records for ${cmtName}`);
    }

    logInfo(`Analyzed CMT ${cmtName}: ${fieldsResult.records.length} fields`);
  } catch (error) {
    const msg = `Error analyzing CMT ${cmtName}: ${error instanceof Error ? error.message : String(error)}`;
    logWarn(msg);
    warnings.push(msg);
  }

  timer.log(`analyzeCustomMetadata(${cmtName})`);
  return { nodes, edges, warnings };
}

/**
 * Analyze Workflow Rules for an object
 */
export async function analyzeWorkflows(
  objectName: string,
  config?: SfConnectionConfig,
): Promise<AnalysisResult> {
  const timer = createTimer();
  const nodes: DependencyNode[] = [];
  const edges: DependencyEdge[] = [];
  const warnings: string[] = [];

  logInfo(`Analyzing workflows for ${objectName}`);

  const objectNodeId = `CustomObject:${objectName}`;

  try {
    // Note: WorkflowRule is not directly queryable via Tooling API in all orgs
    // We'll query related components instead

    // Get Field Updates
    const fieldUpdatesQuery = `
      SELECT Id, Name, SourceObject
      FROM WorkflowFieldUpdate
      WHERE SourceObject = '${objectName}'
    `;

    try {
      const fieldUpdates = await executeToolingQuery<{
        Id: string;
        Name: string;
        SourceObject: string;
      }>(fieldUpdatesQuery, config);

      for (const update of fieldUpdates.records) {
        const nodeId = `WorkflowFieldUpdate:${objectName}.${update.Name}`;

        nodes.push({
          id: nodeId,
          name: update.Name,
          type: "WorkflowFieldUpdate",
          apiName: `${objectName}.${update.Name}`,
          depth: 1,
          isLeaf: true,
          parentId: objectNodeId,
        });

        edges.push({
          sourceId: objectNodeId,
          targetId: nodeId,
          relationshipType: "workflowUpdate",
        });
      }

      logDebug(`Found ${fieldUpdates.records.length} workflow field updates`);
    } catch (error) {
      logDebug(`WorkflowFieldUpdate query failed: ${error}`);
    }

    // Get Email Alerts
    const emailAlertsQuery = `
      SELECT Id, DeveloperName, SenderType
      FROM WorkflowAlert
    `;

    try {
      const emailAlerts = await executeToolingQuery<{
        Id: string;
        DeveloperName: string;
        SenderType: string;
      }>(emailAlertsQuery, config);

      // Filter for object-specific alerts would require more metadata
      logDebug(`Found ${emailAlerts.records.length} workflow email alerts in org`);
    } catch (error) {
      logDebug(`WorkflowAlert query failed: ${error}`);
    }
  } catch (error) {
    const msg = `Error analyzing workflows for ${objectName}: ${error instanceof Error ? error.message : String(error)}`;
    logWarn(msg);
    warnings.push(msg);
  }

  timer.log(`analyzeWorkflows(${objectName})`);
  return { nodes, edges, warnings };
}

/**
 * Analyze Process Builder processes for an object
 */
export async function analyzeProcessBuilders(
  objectName: string,
  config?: SfConnectionConfig,
): Promise<AnalysisResult> {
  const timer = createTimer();
  const nodes: DependencyNode[] = [];
  const edges: DependencyEdge[] = [];
  const warnings: string[] = [];

  logInfo(`Analyzing Process Builders for ${objectName}`);

  const objectNodeId = `CustomObject:${objectName}`;

  try {
    const query = `
      SELECT Id, MasterLabel, DeveloperName, ProcessType, Status
      FROM Flow
      WHERE TriggerObjectOrEvent = '${objectName}'
      AND ProcessType = 'Workflow'
      AND Status = 'Active'
    `;

    const result = await executeToolingQuery<{
      Id: string;
      MasterLabel: string;
      DeveloperName: string;
      ProcessType: string;
      Status: string;
    }>(query, config);

    for (const process of result.records) {
      const nodeId = `ProcessBuilder:${process.DeveloperName}`;

      nodes.push({
        id: nodeId,
        name: process.MasterLabel,
        type: "ProcessBuilder",
        apiName: process.DeveloperName,
        depth: 1,
        isLeaf: true,
        parentId: objectNodeId,
        metadata: {
          status: process.Status,
          processType: process.ProcessType,
        },
      });

      edges.push({
        sourceId: objectNodeId,
        targetId: nodeId,
        relationshipType: "triggers",
      });
    }

    logInfo(`Found ${result.records.length} Process Builders for ${objectName}`);
  } catch (error) {
    const msg = `Error analyzing Process Builders for ${objectName}: ${error instanceof Error ? error.message : String(error)}`;
    logWarn(msg);
    warnings.push(msg);
  }

  timer.log(`analyzeProcessBuilders(${objectName})`);
  return { nodes, edges, warnings };
}

/**
 * Analyze Record-Triggered Flows for an object
 */
export async function analyzeRecordTriggeredFlows(
  objectName: string,
  config?: SfConnectionConfig,
): Promise<AnalysisResult> {
  const timer = createTimer();
  const nodes: DependencyNode[] = [];
  const edges: DependencyEdge[] = [];
  const warnings: string[] = [];

  logInfo(`Analyzing Record-Triggered Flows for ${objectName}`);

  const objectNodeId = `CustomObject:${objectName}`;

  try {
    const query = `
      SELECT Id, MasterLabel, DeveloperName, TriggerType, RecordTriggerType, Status
      FROM Flow
      WHERE TriggerObjectOrEvent = '${objectName}'
      AND ProcessType = 'AutoLaunchedFlow'
      AND TriggerType = 'RecordAfterSave'
      AND IsActive = true
    `;

    const result = await executeToolingQuery<{
      Id: string;
      MasterLabel: string;
      DeveloperName: string;
      TriggerType: string;
      RecordTriggerType: string;
      Status: string;
    }>(query, config);

    for (const flow of result.records) {
      const nodeId = `Flow:${flow.DeveloperName}`;

      nodes.push({
        id: nodeId,
        name: flow.MasterLabel,
        type: "Flow",
        apiName: flow.DeveloperName,
        depth: 1,
        isLeaf: true,
        parentId: objectNodeId,
        metadata: {
          triggerType: flow.TriggerType,
          recordTriggerType: flow.RecordTriggerType,
          status: flow.Status,
        },
      });

      edges.push({
        sourceId: objectNodeId,
        targetId: nodeId,
        relationshipType: "triggers",
      });
    }

    logInfo(`Found ${result.records.length} Record-Triggered Flows for ${objectName}`);
  } catch (error) {
    const msg = `Error analyzing Record-Triggered Flows for ${objectName}: ${error instanceof Error ? error.message : String(error)}`;
    logWarn(msg);
    warnings.push(msg);
  }

  timer.log(`analyzeRecordTriggeredFlows(${objectName})`);
  return { nodes, edges, warnings };
}

/**
 * Analyze sharing rules and settings for an object
 */
export async function analyzeSharingSettings(
  objectName: string,
  config?: SfConnectionConfig,
): Promise<AnalysisResult> {
  const timer = createTimer();
  const nodes: DependencyNode[] = [];
  const edges: DependencyEdge[] = [];
  const warnings: string[] = [];

  logInfo(`Analyzing sharing settings for ${objectName}`);

  try {
    const query = `
      SELECT InternalSharingModel, ExternalSharingModel
      FROM EntityDefinition
      WHERE QualifiedApiName = '${objectName}'
    `;

    const result = await executeToolingQuery<{
      InternalSharingModel: string;
      ExternalSharingModel: string;
    }>(query, config);

    if (result.records.length > 0) {
      const entity = result.records[0]!;

      logInfo(
        `Sharing for ${objectName}: Internal=${entity.InternalSharingModel}, External=${entity.ExternalSharingModel}`,
      );

      // Add metadata to the object node if it exists
      // This is informational - doesn't create new nodes
    }
  } catch (error) {
    const msg = `Error analyzing sharing settings for ${objectName}: ${error instanceof Error ? error.message : String(error)}`;
    logWarn(msg);
    warnings.push(msg);
  }

  timer.log(`analyzeSharingSettings(${objectName})`);
  return { nodes, edges, warnings };
}

/**
 * Run all analyzers for an object
 */
export async function runAllAnalyzers(
  objectName: string,
  config?: SfConnectionConfig,
): Promise<AnalysisResult> {
  const timer = createTimer();
  const allNodes: DependencyNode[] = [];
  const allEdges: DependencyEdge[] = [];
  const allWarnings: string[] = [];

  logInfo(`Running all analyzers for ${objectName}`);

  // Run analyzers in parallel
  const results = await Promise.all([
    analyzeStandardFields(objectName, config),
    analyzeWorkflows(objectName, config),
    analyzeProcessBuilders(objectName, config),
    analyzeRecordTriggeredFlows(objectName, config),
  ]);

  for (const result of results) {
    allNodes.push(...result.nodes);
    allEdges.push(...result.edges);
    allWarnings.push(...result.warnings);
  }

  logInfo(
    `All analyzers complete for ${objectName}: ${allNodes.length} nodes, ${allEdges.length} edges`,
  );
  timer.log(`runAllAnalyzers(${objectName})`);

  return {
    nodes: allNodes,
    edges: allEdges,
    warnings: allWarnings,
  };
}
