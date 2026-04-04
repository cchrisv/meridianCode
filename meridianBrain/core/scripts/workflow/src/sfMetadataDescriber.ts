/**
 * Salesforce Metadata Describer
 * Describes objects, fields, and metadata
 */

import { createSfConnection, type SfConnectionConfig } from "./sfClient.js";
import { executeSoqlQuery, executeToolingQuery } from "./sfQueryExecutor.js";
import { retryWithBackoff, RETRY_PRESETS } from "./lib/retryWithBackoff.js";
import { logInfo, createTimer } from "./lib/loggerStructured.js";
import type {
  DescribeSObjectResult,
  DescribeFieldResult,
  EntityDefinition,
  FieldDefinition,
  ApexClass,
  ApexTrigger,
  ValidationRule,
  Flow,
} from "./types/sfMetadataTypes.js";

/**
 * Describe an SObject
 *
 * @param objectName - API name of the object
 * @param config - Connection config
 * @returns Object describe result
 */
export async function describeObject(
  objectName: string,
  config?: SfConnectionConfig,
): Promise<DescribeSObjectResult> {
  const timer = createTimer();

  logInfo(`Describing object: ${objectName}`);

  const { connection } = await createSfConnection(config);

  const result = await retryWithBackoff(() => connection.describe(objectName), {
    ...RETRY_PRESETS.standard,
    operationName: `describeObject(${objectName})`,
  });

  // Convert to our type
  const describe: DescribeSObjectResult = {
    name: result.name,
    label: result.label,
    labelPlural: result.labelPlural,
    keyPrefix: result.keyPrefix ?? "",
    custom: result.custom,
    customSetting: result.customSetting,
    createable: result.createable,
    updateable: result.updateable,
    deletable: result.deletable,
    queryable: result.queryable,
    searchable: result.searchable,
    layoutable: result.layoutable,
    triggerable: result.triggerable,
    fields: result.fields.map((f) => ({
      name: f.name,
      label: f.label,
      type: f.type,
      length: f.length,
      precision: f.precision,
      scale: f.scale,
      nillable: f.nillable,
      unique: f.unique,
      createable: f.createable,
      updateable: f.updateable,
      filterable: f.filterable,
      sortable: f.sortable,
      groupable: f.groupable,
      custom: f.custom,
      calculated: f.calculated,
      defaultValue: f.defaultValue,
      inlineHelpText: f.inlineHelpText ?? undefined,
      picklistValues: f.picklistValues?.map((p) => ({
        value: p.value,
        label: p.label,
        active: p.active,
        defaultValue: p.defaultValue,
      })),
      referenceTo: f.referenceTo ?? undefined,
      relationshipName: f.relationshipName ?? undefined,
    })),
    recordTypeInfos: result.recordTypeInfos?.map((rt) => ({
      recordTypeId: rt.recordTypeId ?? "",
      name: rt.name,
      developerName: ((rt as Record<string, unknown>)["developerName"] as string) ?? "",
      available: rt.available,
      master: rt.master,
      defaultRecordTypeMapping: rt.defaultRecordTypeMapping,
    })),
    childRelationships: result.childRelationships?.map((cr) => ({
      childSObject: cr.childSObject,
      field: cr.field,
      relationshipName: cr.relationshipName ?? "",
      cascadeDelete: cr.cascadeDelete,
      deprecatedAndHidden: cr.deprecatedAndHidden,
      restrictedDelete: cr.restrictedDelete,
    })),
  };

  logInfo(`Described ${objectName}: ${describe.fields.length} fields`);
  timer.log(`describeObject(${objectName})`);

  return describe;
}

/**
 * Describe a specific field
 *
 * @param objectName - Object API name
 * @param fieldName - Field API name
 * @param config - Connection config
 * @returns Field describe result
 */
export async function describeField(
  objectName: string,
  fieldName: string,
  config?: SfConnectionConfig,
): Promise<DescribeFieldResult> {
  const timer = createTimer();

  logInfo(`Describing field: ${objectName}.${fieldName}`);

  const objectDescribe = await describeObject(objectName, config);

  const field = objectDescribe.fields.find((f) => f.name.toLowerCase() === fieldName.toLowerCase());

  if (!field) {
    throw new Error(`Field ${fieldName} not found on ${objectName}`);
  }

  timer.log(`describeField(${objectName}.${fieldName})`);
  return field;
}

/**
 * Get entity definition from Tooling API
 *
 * @param objectName - Object API name
 * @param config - Connection config
 * @returns Entity definition
 */
export async function getEntityDefinition(
  objectName: string,
  config?: SfConnectionConfig,
): Promise<EntityDefinition | undefined> {
  const timer = createTimer();

  logInfo(`Getting entity definition: ${objectName}`);

  const query = `
    SELECT Id, DurableId, QualifiedApiName, NamespacePrefix, DeveloperName,
           MasterLabel, Label, PluralLabel, KeyPrefix, IsCustomSetting,
           IsCustomizable, IsApexTriggerable, IsWorkflowEnabled, IsProcessEnabled,
           IsLayoutable, IsCompactLayoutable, DeploymentStatus, IsSearchable,
           IsQueryable, IsIdEnabled, IsReplicateable, IsRetrieveable,
           InternalSharingModel, ExternalSharingModel, PublisherId
    FROM EntityDefinition
    WHERE QualifiedApiName = '${objectName}'
  `;

  const result = await executeToolingQuery<EntityDefinition>(query, config);

  timer.log(`getEntityDefinition(${objectName})`);
  return result.records[0];
}

/**
 * Get field definitions for an object from Tooling API
 *
 * @param objectName - Object API name
 * @param config - Connection config
 * @returns Array of field definitions
 */
export async function getFieldDefinitions(
  objectName: string,
  config?: SfConnectionConfig,
): Promise<FieldDefinition[]> {
  const timer = createTimer();

  logInfo(`Getting field definitions for: ${objectName}`);

  // First get the EntityDefinition to get its DurableId
  const entity = await getEntityDefinition(objectName, config);
  if (!entity) {
    throw new Error(`Entity ${objectName} not found`);
  }

  const query = `
    SELECT Id, DurableId, QualifiedApiName, EntityDefinitionId, NamespacePrefix,
           DeveloperName, MasterLabel, Label, Length, DataType, ValueTypeId,
           ReferenceTo, ReferenceTargetField, IsCompound, IsHighScaleNumber,
           IsHtmlFormatted, IsNameField, IsNillable, IsCalculated,
           IsApiFilterable, IsApiSortable, IsApiGroupable, IsPolymorphicForeignKey,
           IsCompactLayoutable, Precision, Scale, IsFieldHistoryTracked,
           IsIndexed, IsUnique, IsDeprecatedAndHidden, Description,
           InlineHelpText, RelationshipName, LastModifiedDate, PublisherId
    FROM FieldDefinition
    WHERE EntityDefinitionId = '${entity.DurableId}'
  `;

  const result = await executeToolingQuery<FieldDefinition>(query, config);

  logInfo(`Got ${result.records.length} field definitions for ${objectName}`);
  timer.log(`getFieldDefinitions(${objectName})`);

  return result.records;
}

/**
 * Get Apex classes
 *
 * @param namePattern - Optional name pattern (use % for wildcard)
 * @param config - Connection config
 * @returns Array of Apex classes
 */
export async function getApexClasses(
  namePattern?: string,
  config?: SfConnectionConfig,
): Promise<ApexClass[]> {
  const timer = createTimer();

  logInfo("Getting Apex classes", { namePattern });

  let query = `
    SELECT Id, Name, NamespacePrefix, ApiVersion, Status, IsValid, LengthWithoutComments
    FROM ApexClass
  `;

  if (namePattern) {
    query += ` WHERE Name LIKE '${namePattern}'`;
  }

  query += " ORDER BY Name";

  const result = await executeToolingQuery<ApexClass>(query, config);

  logInfo(`Got ${result.records.length} Apex classes`);
  timer.log("getApexClasses");

  return result.records;
}

/**
 * Get Apex triggers for an object
 *
 * @param objectName - Object API name (optional)
 * @param config - Connection config
 * @returns Array of Apex triggers
 */
export async function getApexTriggers(
  objectName?: string,
  config?: SfConnectionConfig,
): Promise<ApexTrigger[]> {
  const timer = createTimer();

  logInfo("Getting Apex triggers", { objectName });

  let query = `
    SELECT Id, Name, NamespacePrefix, TableEnumOrId, ApiVersion, Status, IsValid,
           LengthWithoutComments, UsageBeforeInsert, UsageAfterInsert,
           UsageBeforeUpdate, UsageAfterUpdate, UsageBeforeDelete,
           UsageAfterDelete, UsageAfterUndelete, UsageIsBulk
    FROM ApexTrigger
  `;

  if (objectName) {
    query += ` WHERE TableEnumOrId = '${objectName}'`;
  }

  query += " ORDER BY Name";

  const result = await executeToolingQuery<ApexTrigger>(query, config);

  logInfo(`Got ${result.records.length} Apex triggers`);
  timer.log("getApexTriggers");

  return result.records;
}

/**
 * Get validation rules for an object
 *
 * @param objectName - Object API name
 * @param activeOnly - Only return active rules
 * @param config - Connection config
 * @returns Array of validation rules
 */
export async function getValidationRules(
  objectName: string,
  activeOnly = true,
  config?: SfConnectionConfig,
): Promise<ValidationRule[]> {
  const timer = createTimer();

  logInfo(`Getting validation rules for: ${objectName}`);

  // Get entity definition first
  const entity = await getEntityDefinition(objectName, config);
  if (!entity) {
    throw new Error(`Entity ${objectName} not found`);
  }

  let query = `
    SELECT Id, ValidationName, EntityDefinitionId, Active, Description,
           ErrorDisplayField, ErrorMessage, FullName, Metadata
    FROM ValidationRule
    WHERE EntityDefinitionId = '${entity.DurableId}'
  `;

  if (activeOnly) {
    query += " AND Active = true";
  }

  const result = await executeToolingQuery<ValidationRule>(query, config);

  logInfo(`Got ${result.records.length} validation rules for ${objectName}`);
  timer.log(`getValidationRules(${objectName})`);

  return result.records;
}

/**
 * Get flows related to an object
 *
 * @param objectName - Object API name (optional)
 * @param activeOnly - Only return active flows
 * @param config - Connection config
 * @returns Array of flows
 */
export async function getFlows(
  objectName?: string,
  activeOnly = true,
  config?: SfConnectionConfig,
): Promise<Flow[]> {
  const timer = createTimer();

  logInfo("Getting flows", { objectName, activeOnly });

  // Use FlowDefinitionView (standard API) — it has DeveloperName, TriggerType,
  // TriggerObjectOrEvent, and all fields we need in a single queryable entity.
  // The Tooling API Flow entity is missing many of these fields.

  let query = `
    SELECT Id, ApiName, Label, ProcessType, TriggerType,
           TriggerObjectOrEventId, TriggerObjectOrEventLabel,
           IsActive, Description, RecordTriggerType, NamespacePrefix,
           ActiveVersionId, IsTemplate, LastModifiedDate
    FROM FlowDefinitionView
  `;

  const conditions: string[] = [];

  if (objectName) {
    // For --object filter, resolve the object label since FlowDefinitionView
    // stores the object label (not API name) in TriggerObjectOrEventLabel.
    // Standard objects: label = API name (e.g., 'Account')
    // Custom objects: label = display name (e.g., 'Journey Pipeline' for Journey_Pipeline__c)
    let objectLabel = objectName;
    try {
      const labelResult = await executeToolingQuery<{ Label: string }>(
        `SELECT Label FROM EntityDefinition WHERE QualifiedApiName = '${objectName}' LIMIT 1`,
        config,
      );
      if (labelResult.records.length > 0) {
        objectLabel = labelResult.records[0]!.Label;
        logInfo(`Resolved object label: ${objectName} → ${objectLabel}`);
      }
    } catch (error) {
      logInfo(
        `Could not resolve object label, using API name: ${error instanceof Error ? error.message : error}`,
      );
    }
    conditions.push(`TriggerObjectOrEventLabel = '${objectLabel}'`);
  }

  if (activeOnly) {
    conditions.push("IsActive = true");
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }

  query += " ORDER BY Label";

  // FlowDefinitionView uses standard API (not Tooling API)
  interface FlowDefView {
    Id: string;
    ApiName: string;
    Label: string;
    ProcessType: string;
    TriggerType: string | null;
    TriggerObjectOrEventId: string | null;
    TriggerObjectOrEventLabel: string | null;
    IsActive: boolean;
    Description: string | null;
    RecordTriggerType: string | null;
    NamespacePrefix: string | null;
    ActiveVersionId: string | null;
    IsTemplate: boolean;
    LastModifiedDate: string;
  }

  const result = await executeSoqlQuery<FlowDefView>(query, config);

  logInfo(`Got ${result.records.length} flows`);

  // Map FlowDefinitionView to our Flow interface
  const flows: Flow[] = result.records.map((r) => ({
    Id: r.ActiveVersionId || r.Id,
    DefinitionId: r.Id,
    DeveloperName: r.ApiName,
    MasterLabel: r.Label,
    NamespacePrefix: r.NamespacePrefix,
    ApiVersion: 0, // Not available from FlowDefinitionView
    ProcessType: r.ProcessType,
    Status: r.IsActive ? "Active" : "Inactive",
    Description: r.Description,
    TriggerType: r.TriggerType,
    TriggerObjectOrEvent: r.TriggerObjectOrEventLabel,
    RecordTriggerType: r.RecordTriggerType,
    IsActive: r.IsActive,
    IsTemplate: r.IsTemplate,
    RunInMode: "", // Not available from FlowDefinitionView
    LastModifiedDate: r.LastModifiedDate,
    LastModifiedById: "", // Not available from FlowDefinitionView
  }));

  timer.log("getFlows");

  return flows;
}

/**
 * Get all custom objects
 *
 * @param config - Connection config
 * @returns Array of custom object names
 */
export async function getCustomObjects(config?: SfConnectionConfig): Promise<string[]> {
  const timer = createTimer();

  logInfo("Getting custom objects");

  const query = `
    SELECT QualifiedApiName
    FROM EntityDefinition
    WHERE IsCustomizable = true AND IsCustomSetting = false
    ORDER BY QualifiedApiName
  `;

  const result = await executeToolingQuery<{ QualifiedApiName: string }>(query, config);

  const customObjects = result.records
    .map((r) => r.QualifiedApiName)
    .filter((name) => name.endsWith("__c"));

  logInfo(`Got ${customObjects.length} custom objects`);
  timer.log("getCustomObjects");

  return customObjects;
}
