/**
 * Salesforce Query Executor
 * Executes SOQL and Tooling API queries
 */

import { createSfConnection, type SfConnectionConfig } from "./sfClient.js";
import { retryWithBackoff, RETRY_PRESETS } from "./lib/retryWithBackoff.js";
import { logInfo, logDebug, logError, createTimer } from "./lib/loggerStructured.js";
import { validate, QueryOptionsSchema } from "./lib/validationSchemas.js";
import type {
  QueryResult,
  ToolingQueryResult,
  QueryOptions,
  QueryExecutionResult,
  BatchQueryRequest,
  BatchQueryResult,
} from "./types/sfQueryTypes.js";

/**
 * Execute a SOQL query
 *
 * @param query - SOQL query string
 * @param config - Connection config
 * @returns Query result with records
 */
export async function executeSoqlQuery<T = Record<string, unknown>>(
  query: string,
  config?: SfConnectionConfig,
): Promise<QueryResult<T>> {
  const timer = createTimer();

  logInfo("Executing SOQL query");
  logDebug("Query", { query });

  const { connection } = await createSfConnection(config);

  const result = await retryWithBackoff(
    async () => {
      const queryResult = await connection.query<T>(query);
      return {
        done: queryResult.done,
        totalSize: queryResult.totalSize,
        records: queryResult.records,
        nextRecordsUrl: queryResult.nextRecordsUrl,
      };
    },
    { ...RETRY_PRESETS.standard, operationName: "executeSoqlQuery" },
  );

  logInfo(`Query returned ${result.totalSize} records`);
  timer.log("executeSoqlQuery");

  return result;
}

/**
 * Execute a Tooling API query
 *
 * @param query - SOQL query string for Tooling API
 * @param config - Connection config
 * @returns Query result with records
 */
export async function executeToolingQuery<T = Record<string, unknown>>(
  query: string,
  config?: SfConnectionConfig,
): Promise<ToolingQueryResult<T>> {
  const timer = createTimer();

  logInfo("Executing Tooling API query");
  logDebug("Query", { query });

  const { connection } = await createSfConnection(config);

  const result = await retryWithBackoff(
    async () => {
      const queryResult = await connection.tooling.query<T>(query);
      return {
        done: queryResult.done,
        totalSize: queryResult.totalSize,
        records: queryResult.records,
        nextRecordsUrl: queryResult.nextRecordsUrl,
        entityTypeName: queryResult.entityTypeName,
      };
    },
    { ...RETRY_PRESETS.standard, operationName: "executeToolingQuery" },
  );

  logInfo(`Tooling query returned ${result.totalSize} records`);
  timer.log("executeToolingQuery");

  return result;
}

/**
 * Execute a query with full options
 *
 * @param options - Query options
 * @param config - Connection config
 * @returns Query execution result with metadata
 */
export async function executeQuery<T = Record<string, unknown>>(
  options: QueryOptions,
  config?: SfConnectionConfig,
): Promise<QueryExecutionResult<T>> {
  const timer = createTimer();
  const validatedOptions = validate(QueryOptionsSchema, options);

  logInfo("Executing query", { useToolingApi: validatedOptions.useToolingApi });

  try {
    let result: QueryResult<T>;

    if (validatedOptions.useToolingApi) {
      result = await executeToolingQuery<T>(validatedOptions.query, config);
    } else {
      result = await executeSoqlQuery<T>(validatedOptions.query, config);
    }

    // Limit records if maxRecords is specified
    if (validatedOptions.maxRecords && result.records.length > validatedOptions.maxRecords) {
      result.records = result.records.slice(0, validatedOptions.maxRecords);
    }

    return {
      success: true,
      data: result,
      executionTime: timer.elapsed(),
    };
  } catch (error) {
    logError("Query execution failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      data: { done: true, totalSize: 0, records: [] },
      error: error instanceof Error ? error.message : String(error),
      executionTime: timer.elapsed(),
    };
  }
}

/**
 * Execute multiple queries in batch
 *
 * @param request - Batch query request
 * @param config - Connection config
 * @returns Batch query results
 */
export async function executeBatchQueries(
  request: BatchQueryRequest,
  config?: SfConnectionConfig,
): Promise<BatchQueryResult> {
  const timer = createTimer();

  logInfo(`Executing batch of ${request.queries.length} queries`);

  const results: Record<string, QueryExecutionResult> = {};
  const errors: Array<{ name: string; error: string }> = [];

  // Execute queries in parallel with concurrency limit
  const CONCURRENCY = 5;
  const queries = [...request.queries];

  while (queries.length > 0) {
    const batch = queries.splice(0, CONCURRENCY);

    await Promise.all(
      batch.map(async (queryDef) => {
        try {
          const result = await executeQuery(
            {
              query: queryDef.query,
              useToolingApi: queryDef.useToolingApi,
            },
            config,
          );
          results[queryDef.name] = result;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push({ name: queryDef.name, error: errorMsg });
          results[queryDef.name] = {
            success: false,
            data: { done: true, totalSize: 0, records: [] },
            error: errorMsg,
          };
        }
      }),
    );
  }

  const totalTime = timer.elapsed();
  logInfo(`Batch execution completed in ${totalTime}ms`, {
    successful: Object.values(results).filter((r) => r.success).length,
    failed: errors.length,
  });

  return {
    results,
    totalExecutionTime: totalTime,
    errors,
  };
}

/**
 * Execute a query and get all records (handles pagination)
 *
 * @param query - SOQL query string
 * @param config - Connection config
 * @returns All records from query
 */
export async function queryAll<T = Record<string, unknown>>(
  query: string,
  config?: SfConnectionConfig,
): Promise<T[]> {
  const timer = createTimer();

  logInfo("Executing queryAll");
  logDebug("Query", { query });

  const { connection } = await createSfConnection(config);

  const allRecords: T[] = [];

  const result = await retryWithBackoff(() => connection.query<T>(query), {
    ...RETRY_PRESETS.standard,
    operationName: "queryAll-initial",
  });

  allRecords.push(...result.records);

  // Fetch additional records if there are more
  let nextRecordsUrl = result.nextRecordsUrl;
  while (nextRecordsUrl) {
    logDebug(`Fetching more records from ${nextRecordsUrl}`);

    const moreResult = await retryWithBackoff(
      () => connection.queryMore<T>(nextRecordsUrl as string),
      { ...RETRY_PRESETS.standard, operationName: "queryAll-more" },
    );

    allRecords.push(...moreResult.records);
    nextRecordsUrl = moreResult.nextRecordsUrl;
  }

  logInfo(`queryAll returned ${allRecords.length} total records`);
  timer.log("queryAll");

  return allRecords;
}

/**
 * Count records matching a query
 *
 * @param objectName - SObject name
 * @param whereClause - Optional WHERE clause (without WHERE keyword)
 * @param config - Connection config
 * @returns Record count
 */
export async function countRecords(
  objectName: string,
  whereClause?: string,
  config?: SfConnectionConfig,
): Promise<number> {
  const query = whereClause
    ? `SELECT COUNT() FROM ${objectName} WHERE ${whereClause}`
    : `SELECT COUNT() FROM ${objectName}`;

  const result = await executeSoqlQuery<{ expr0: number }>(query, config);
  return result.totalSize;
}

/**
 * Check if any records exist matching criteria
 *
 * @param objectName - SObject name
 * @param whereClause - WHERE clause (without WHERE keyword)
 * @param config - Connection config
 * @returns True if records exist
 */
export async function recordsExist(
  objectName: string,
  whereClause: string,
  config?: SfConnectionConfig,
): Promise<boolean> {
  const query = `SELECT Id FROM ${objectName} WHERE ${whereClause} LIMIT 1`;
  const result = await executeSoqlQuery(query, config);
  return result.totalSize > 0;
}
