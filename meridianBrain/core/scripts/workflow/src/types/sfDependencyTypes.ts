/**
 * Salesforce Dependency Types
 * Type definitions for metadata dependency discovery
 */

/**
 * Dependency node in the graph
 */
export interface DependencyNode {
  id: string;
  name: string;
  type: MetadataType;
  apiName: string;
  namespace?: string;
  depth: number;
  isLeaf: boolean;
  isCircular?: boolean;
  parentId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Metadata types for dependencies
 */
export type MetadataType =
  | "CustomObject"
  | "CustomField"
  | "ApexClass"
  | "ApexTrigger"
  | "ApexPage"
  | "ApexComponent"
  | "AuraDefinitionBundle"
  | "LightningComponentBundle"
  | "Flow"
  | "FlowDefinition"
  | "ValidationRule"
  | "WorkflowRule"
  | "WorkflowFieldUpdate"
  | "WorkflowAlert"
  | "ProcessBuilder"
  | "CustomMetadataType"
  | "CustomSetting"
  | "CustomLabel"
  | "Layout"
  | "RecordType"
  | "FieldSet"
  | "CompactLayout"
  | "ListView"
  | "Report"
  | "Dashboard"
  | "PermissionSet"
  | "Profile"
  | "Unknown";

/**
 * Dependency edge connecting nodes
 */
export interface DependencyEdge {
  sourceId: string;
  targetId: string;
  relationshipType: DependencyRelationship;
  description?: string;
}

/**
 * Types of dependency relationships
 */
export type DependencyRelationship =
  | "references"
  | "contains"
  | "extends"
  | "implements"
  | "triggers"
  | "uses"
  | "lookupTo"
  | "masterDetail"
  | "formulaReference"
  | "workflowUpdate"
  | "validationReference"
  | "flowReference"
  | "apex_reference"
  | "unknown";

/**
 * Full dependency graph
 */
export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: DependencyEdge[];
  rootId: string;
  metadata: DependencyGraphMetadata;
}

/**
 * Dependency graph metadata
 */
export interface DependencyGraphMetadata {
  generatedAt: string;
  rootType: MetadataType;
  rootName: string;
  maxDepth: number;
  nodeCount: number;
  edgeCount: number;
  hasCircularDependencies: boolean;
  circularPaths?: string[][];
}

/**
 * Usage pill for enrichment
 */
export interface UsagePill {
  id: string;
  type: UsagePillType;
  label: string;
  description: string;
  severity: UsageSeverity;
  affectedComponents: string[];
  recommendation?: string;
}

/**
 * Types of usage pills
 */
export type UsagePillType =
  | "apex_usage"
  | "flow_usage"
  | "validation_usage"
  | "workflow_usage"
  | "formula_usage"
  | "layout_usage"
  | "report_usage"
  | "integration_usage"
  | "permission_usage"
  | "field_reference"
  | "hardcoded_reference"
  | "dynamic_reference";

/**
 * Severity levels for usage pills
 */
export type UsageSeverity = "info" | "warning" | "critical";

/**
 * Options for dependency discovery
 */
export interface DiscoverDependenciesOptions {
  rootType: MetadataType;
  rootName: string;
  maxDepth?: number;
  includeStandardObjects?: boolean;
  includeNamespaced?: boolean;
  excludeTypes?: MetadataType[];
  parallelQueries?: number;
}

/**
 * Dependency discovery result
 */
export interface DiscoveryResult {
  graph: DependencyGraph;
  pills: UsagePill[];
  warnings: string[];
  executionTime: number;
}

/**
 * Traversal options
 */
export interface TraversalOptions {
  maxDepth: number;
  detectCycles: boolean;
  onNodeVisit?: (node: DependencyNode) => void;
  onCycleDetected?: (path: string[]) => void;
}

/**
 * Cycle detection result
 */
export interface CycleDetectionResult {
  hasCycles: boolean;
  cycles: string[][];
  visitedNodes: Set<string>;
}

/**
 * Enrichment options
 */
export interface EnrichmentOptions {
  includeApexUsage?: boolean;
  includeFlowUsage?: boolean;
  includeValidationUsage?: boolean;
  includeWorkflowUsage?: boolean;
  includeFormulaUsage?: boolean;
  includeLayoutUsage?: boolean;
  includeReportUsage?: boolean;
}

/**
 * Enrichment result
 */
export interface EnrichmentResult {
  pills: UsagePill[];
  enrichedNodes: Map<string, DependencyNode>;
  analysisTime: number;
}
