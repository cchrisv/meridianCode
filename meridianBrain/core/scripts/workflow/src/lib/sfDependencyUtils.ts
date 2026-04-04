/**
 * Salesforce Dependency Utilities
 * Helper functions for dependency discovery and analysis
 */

/**
 * Check if a string contains a dynamic reference
 * Dynamic references are harder to track statically
 */
export function isDynamicReference(code: string): boolean {
  const dynamicPatterns = [
    /Schema\s*\.\s*getGlobalDescribe\s*\(\s*\)/i,
    /Schema\s*\.\s*describeSObjects\s*\(/i,
    /Type\s*\.\s*forName\s*\(/i,
    /Database\s*\.\s*query\s*\(/i,
    /String\s*\.\s*valueOf\s*\(/i,
    /get\s*\(\s*['"][^'"]+['"]\s*\)/i,
    /\[\s*['"][^'"]+['"]\s*\]/i,
  ];

  return dynamicPatterns.some((pattern) => pattern.test(code));
}

/**
 * Strip comments from Apex/JavaScript code
 */
export function stripComments(code: string): string {
  // Remove single-line comments
  let result = code.replace(/\/\/[^\n]*/g, "");

  // Remove multi-line comments
  result = result.replace(/\/\*[\s\S]*?\*\//g, "");

  return result;
}

/**
 * Extract SObject references from code
 */
export function extractSObjectReferences(code: string): string[] {
  const cleanCode = stripComments(code);
  const references = new Set<string>();

  // Pattern for standard SOQL queries
  const soqlPattern = /FROM\s+(\w+)/gi;
  let match;

  while ((match = soqlPattern.exec(cleanCode)) !== null) {
    if (match[1]) {
      references.add(match[1]);
    }
  }

  // Pattern for Schema.SObjectType references
  const schemaPattern = /Schema\.SObjectType\.(\w+)/gi;

  while ((match = schemaPattern.exec(cleanCode)) !== null) {
    if (match[1]) {
      references.add(match[1]);
    }
  }

  // Pattern for new SObject() instantiation
  const newPattern = /new\s+(\w+)\s*\(/gi;

  while ((match = newPattern.exec(cleanCode)) !== null) {
    // Filter out common non-SObject types
    const name = match[1];
    if (name && !isCommonType(name)) {
      references.add(name);
    }
  }

  return Array.from(references);
}

/**
 * Check if a type name is a common non-SObject type
 */
function isCommonType(name: string): boolean {
  const commonTypes = new Set([
    "String",
    "Integer",
    "Boolean",
    "Double",
    "Decimal",
    "Date",
    "DateTime",
    "Time",
    "Blob",
    "Id",
    "Object",
    "List",
    "Set",
    "Map",
    "Exception",
    "DmlException",
    "QueryException",
    "NullPointerException",
    "AsyncException",
    "HttpRequest",
    "HttpResponse",
    "Http",
    "JSON",
    "Test",
    "System",
    "PageReference",
    "ApexPages",
    "Database",
    "Schema",
    "UserInfo",
  ]);

  return commonTypes.has(name);
}

/**
 * Extract field references from code
 */
export function extractFieldReferences(code: string, objectName?: string): string[] {
  const cleanCode = stripComments(code);
  const references = new Set<string>();

  // Pattern for direct field access: object.Field__c
  const fieldPattern = /(\w+)\s*\.\s*(\w+__c)/gi;
  let match;

  while ((match = fieldPattern.exec(cleanCode)) !== null) {
    if (match[1] && match[2]) {
      references.add(`${match[1]}.${match[2]}`);
    }
  }

  // Pattern for SOQL field selection
  const selectPattern = /SELECT\s+([\w\s,.__]+)\s+FROM/gi;

  while ((match = selectPattern.exec(cleanCode)) !== null) {
    if (match[1]) {
      const fields = match[1].split(",").map((f) => f.trim());
      for (const field of fields) {
        if (field.includes("__c") && objectName) {
          references.add(`${objectName}.${field}`);
        }
      }
    }
  }

  return Array.from(references);
}

/**
 * Group items by a key function
 */
export function groupBy<T, K extends string | number>(
  items: T[],
  keyFn: (item: T) => K,
): Record<K, T[]> {
  const result = {} as Record<K, T[]>;

  for (const item of items) {
    const key = keyFn(item);
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(item);
  }

  return result;
}

/**
 * Deduplicate an array by a key function
 */
export function dedupeBy<T, K>(items: T[], keyFn: (item: T) => K): T[] {
  const seen = new Set<K>();
  const result: T[] = [];

  for (const item of items) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }

  return result;
}

/**
 * Parse an API name into object and field parts
 */
export function parseApiName(apiName: string): { object?: string; field?: string } {
  const parts = apiName.split(".");

  if (parts.length === 2) {
    return { object: parts[0], field: parts[1] };
  } else if (parts.length === 1) {
    // Could be object or field depending on context
    return { object: parts[0] };
  }

  return {};
}

/**
 * Build a qualified API name from parts
 */
export function buildApiName(object: string, field?: string): string {
  return field ? `${object}.${field}` : object;
}

/**
 * Check if a name looks like a custom object/field
 */
export function isCustom(name: string): boolean {
  return name.endsWith("__c");
}

/**
 * Check if a name looks like a managed package component
 */
export function isManaged(name: string): boolean {
  return /^[\w]+__[\w]+__c$/.test(name) || /^[\w]+__[\w]+__[\w]+$/.test(name);
}

/**
 * Extract namespace from a managed package component name
 */
export function extractNamespace(name: string): string | undefined {
  const match = /^([\w]+)__/.exec(name);

  // Check it's not just a custom object suffix
  if (match && match[1] && !["c", "r", "mdt", "e", "b", "x"].includes(match[1])) {
    return match[1];
  }

  return undefined;
}

/**
 * Sort dependencies by depth (shallow first)
 */
export function sortByDepth<T extends { depth: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.depth - b.depth);
}

/**
 * Chunk an array into smaller arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }

  return chunks;
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retryAsync<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 1000,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries - 1) {
        const delay = initialDelayMs * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}
