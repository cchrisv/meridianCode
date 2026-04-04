/**
 * AI Config Scripts V2
 * Main entry point - exports all public APIs
 */

// Types
export * from "./types/index.js";

// ADO Client and Operations
export { createAdoConnection } from "./adoClient.js";
export { getWorkItem, updateWorkItem, createWorkItem, searchWorkItems } from "./adoWorkItems.js";
export { getBacklog, reorderSingle, reorderBulk, validateBacklog } from "./adoBacklogReorder.js";
export { linkWorkItems, getWorkItemRelations } from "./adoWorkItemLinks.js";
export {
  getWikiPage,
  updateWikiPage,
  createWikiPage,
  uploadWikiAttachment,
} from "./adoWikiPages.js";

// SF Client and Operations
export { createSfConnection } from "./sfClient.js";
export { executeSoqlQuery, executeToolingQuery } from "./sfQueryExecutor.js";
export { describeObject, describeField } from "./sfMetadataDescriber.js";

// Dependency Discovery
export {
  discoverDependencies,
  exportGraphToJson,
  exportGraphToDot,
} from "./sfDependencyDiscovery.js";
export {
  traverseDependencies,
  detectCycles,
  getNodesAtDepth,
  getLeafNodes,
  getRootNodes,
  getPathToNode,
  getAllDependencies,
  getAllDependents,
  calculateImpactScore,
  sortByImpact,
  extractSubgraph,
} from "./sfDependencyTraverser.js";
export {
  enrichWithUsagePills,
  filterPillsBySeverity,
  filterPillsByType,
  groupPillsBySeverity,
  getPillsSummary,
  formatPillsForDisplay,
} from "./sfDependencyEnrichment.js";
export {
  analyzeStandardFields,
  analyzeCustomMetadata,
  analyzeWorkflows,
  analyzeProcessBuilders,
  analyzeRecordTriggeredFlows,
  runAllAnalyzers,
} from "./sfDependencyAnalyzers.js";

// Utilities
export { getAzureBearerToken, validateAzureAuth } from "./lib/authAzureCli.js";
export { getSfConnection, validateSfAuth } from "./lib/authSalesforceCli.js";
export { retryWithBackoff } from "./lib/retryWithBackoff.js";
export { logInfo, logWarn, logError, logEvent } from "./lib/loggerStructured.js";
