/**
 * Salesforce Query Types
 * Type definitions for SOQL and Tooling API queries
 */

/**
 * Generic query result from Salesforce
 */
export interface QueryResult<T = Record<string, unknown>> {
  done: boolean;
  totalSize: number;
  records: T[];
  nextRecordsUrl?: string;
}

/**
 * Tooling API query result
 */
export interface ToolingQueryResult<T = Record<string, unknown>> extends QueryResult<T> {
  entityTypeName?: string;
}

/**
 * Query options
 */
export interface QueryOptions {
  query: string;
  useToolingApi?: boolean;
  allRows?: boolean;
  maxRecords?: number;
}

/**
 * Query execution result with metadata
 */
export interface QueryExecutionResult<T = Record<string, unknown>> {
  success: boolean;
  data: QueryResult<T>;
  queryLocator?: string;
  executionTime?: number;
  error?: string;
}

/**
 * Batch query request
 */
export interface BatchQueryRequest {
  queries: Array<{
    name: string;
    query: string;
    useToolingApi?: boolean;
  }>;
}

/**
 * Batch query result
 */
export interface BatchQueryResult {
  results: Record<string, QueryExecutionResult>;
  totalExecutionTime: number;
  errors: Array<{
    name: string;
    error: string;
  }>;
}

/**
 * Common Tooling API entities that can be queried
 */
export type ToolingEntity =
  | "ApexClass"
  | "ApexTrigger"
  | "ApexPage"
  | "ApexComponent"
  | "AuraDefinitionBundle"
  | "LightningComponentBundle"
  | "CustomField"
  | "CustomObject"
  | "EntityDefinition"
  | "FieldDefinition"
  | "Flow"
  | "FlowDefinition"
  | "ValidationRule"
  | "WorkflowRule"
  | "CustomTab"
  | "CustomApplication"
  | "Layout"
  | "Profile"
  | "PermissionSet"
  | "RecordType";

/**
 * SOQL Query Builder options
 */
export interface SOQLBuilderOptions {
  object: string;
  fields: string[];
  where?: string;
  orderBy?: string;
  limit?: number;
  offset?: number;
  includeDeleted?: boolean;
}

/**
 * Build a SOQL query from options
 */
export function buildSOQL(options: SOQLBuilderOptions): string {
  const { object, fields, where, orderBy, limit, offset, includeDeleted } = options;

  let query = `SELECT ${fields.join(", ")} FROM ${object}`;

  if (where) {
    query += ` WHERE ${where}`;
  }

  if (orderBy) {
    query += ` ORDER BY ${orderBy}`;
  }

  if (limit !== undefined) {
    query += ` LIMIT ${limit}`;
  }

  if (offset !== undefined) {
    query += ` OFFSET ${offset}`;
  }

  if (includeDeleted) {
    query += " ALL ROWS";
  }

  return query;
}
