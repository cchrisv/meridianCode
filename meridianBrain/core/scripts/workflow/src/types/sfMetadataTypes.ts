/**
 * Salesforce Metadata Types
 * Type definitions for Salesforce metadata operations
 */

/**
 * Entity Definition from Tooling API
 */
export interface EntityDefinition {
  Id: string;
  DurableId: string;
  QualifiedApiName: string;
  NamespacePrefix: string | null;
  DeveloperName: string;
  MasterLabel: string;
  Label: string;
  PluralLabel: string;
  KeyPrefix: string;
  IsCustomSetting: boolean;
  IsCustomizable: boolean;
  IsApexTriggerable: boolean;
  IsWorkflowEnabled: boolean;
  IsProcessEnabled: boolean;
  IsLayoutable: boolean;
  IsCompactLayoutable: boolean;
  DeploymentStatus: string;
  IsSearchable: boolean;
  IsQueryable: boolean;
  IsIdEnabled: boolean;
  IsReplicateable: boolean;
  IsRetrieveable: boolean;
  InternalSharingModel: string;
  ExternalSharingModel: string;
  RunningUserEntityAccessId: string | null;
  PublisherId: string;
}

/**
 * Field Definition from Tooling API
 */
export interface FieldDefinition {
  Id: string;
  DurableId: string;
  QualifiedApiName: string;
  EntityDefinitionId: string;
  NamespacePrefix: string | null;
  DeveloperName: string;
  MasterLabel: string;
  Label: string;
  Length: number;
  DataType: string;
  ValueTypeId: string;
  ReferenceTo: {
    referenceTo: string[];
  } | null;
  ReferenceTargetField: string | null;
  IsCompound: boolean;
  IsHighScaleNumber: boolean;
  IsHtmlFormatted: boolean;
  IsNameField: boolean;
  IsNillable: boolean;
  IsCalculated: boolean;
  IsApiFilterable: boolean;
  IsApiSortable: boolean;
  IsApiGroupable: boolean;
  IsPolymorphicForeignKey: boolean;
  IsAiPredictionField: boolean;
  IsCompactLayoutable: boolean;
  Precision: number;
  Scale: number;
  IsFieldHistoryTracked: boolean;
  IsIndexed: boolean;
  IsUnique: boolean;
  IsDeprecatedAndHidden: boolean;
  ControllingFieldDefinitionId: string | null;
  BusinessOwnerId: string | null;
  BusinessStatus: string | null;
  ComplianceGroup: string | null;
  SecurityClassification: string | null;
  Description: string | null;
  InlineHelpText: string | null;
  RelationshipName: string | null;
  LastModifiedDate: string;
  LastModifiedById: string;
  PublisherId: string;
  RunningUserFieldAccessId: string | null;
}

/**
 * Custom Field from Tooling API
 */
export interface CustomField {
  Id: string;
  DeveloperName: string;
  NamespacePrefix: string | null;
  TableEnumOrId: string;
  FullName: string;
  Metadata: CustomFieldMetadata;
}

/**
 * Custom Field Metadata
 */
export interface CustomFieldMetadata {
  fullName: string;
  label: string;
  description: string | null;
  type: string;
  length?: number;
  precision?: number;
  scale?: number;
  required?: boolean;
  unique?: boolean;
  externalId?: boolean;
  trackHistory?: boolean;
  trackFeedHistory?: boolean;
  inlineHelpText?: string | null;
  defaultValue?: string | null;
  formula?: string | null;
  referenceTo?: string;
  relationshipLabel?: string;
  relationshipName?: string;
  deleteConstraint?: string;
  valueSet?: ValueSet;
}

/**
 * Value Set for picklists
 */
export interface ValueSet {
  restricted?: boolean;
  valueSetDefinition?: {
    sorted: boolean;
    value: PicklistValue[];
  };
  controllingField?: string;
}

/**
 * Picklist Value
 */
export interface PicklistValue {
  fullName: string;
  label: string;
  default?: boolean;
  isActive?: boolean;
  color?: string;
  description?: string;
}

/**
 * Apex Class metadata
 */
export interface ApexClass {
  Id: string;
  Name: string;
  NamespacePrefix: string | null;
  ApiVersion: number;
  Status: string;
  IsValid: boolean;
  LengthWithoutComments: number;
  Body?: string;
  SymbolTable?: SymbolTable;
}

/**
 * Symbol Table from Apex Class
 */
export interface SymbolTable {
  name: string;
  tableDeclaration: {
    name: string;
    modifiers: string[];
    type: string;
  };
  variables: SymbolTableVariable[];
  methods: SymbolTableMethod[];
  innerClasses?: SymbolTable[];
}

/**
 * Symbol Table Variable
 */
export interface SymbolTableVariable {
  name: string;
  type: string;
  modifiers: string[];
}

/**
 * Symbol Table Method
 */
export interface SymbolTableMethod {
  name: string;
  returnType: string;
  modifiers: string[];
  parameters: Array<{
    name: string;
    type: string;
  }>;
}

/**
 * Apex Trigger metadata
 */
export interface ApexTrigger {
  Id: string;
  Name: string;
  NamespacePrefix: string | null;
  TableEnumOrId: string;
  ApiVersion: number;
  Status: string;
  IsValid: boolean;
  LengthWithoutComments: number;
  UsageBeforeInsert: boolean;
  UsageAfterInsert: boolean;
  UsageBeforeUpdate: boolean;
  UsageAfterUpdate: boolean;
  UsageBeforeDelete: boolean;
  UsageAfterDelete: boolean;
  UsageAfterUndelete: boolean;
  UsageIsBulk: boolean;
  Body?: string;
}

/**
 * Validation Rule
 */
export interface ValidationRule {
  Id: string;
  ValidationName: string;
  EntityDefinitionId: string;
  Active: boolean;
  Description: string | null;
  ErrorDisplayField: string | null;
  ErrorMessage: string;
  FullName: string;
  Metadata: {
    active: boolean;
    description: string | null;
    errorConditionFormula: string;
    errorDisplayField: string | null;
    errorMessage: string;
    fullName: string;
  };
}

/**
 * Flow metadata
 * Note: DeveloperName is on FlowDefinition, not Flow.
 * getFlows() merges it from a separate FlowDefinition query.
 */
export interface Flow {
  Id: string;
  DefinitionId: string;
  DeveloperName: string; // merged from FlowDefinition
  MasterLabel: string;
  NamespacePrefix: string | null;
  ApiVersion: number;
  ProcessType: string;
  Status: string;
  Description: string | null;
  TriggerType: string | null;
  TriggerObjectOrEvent: string | null;
  RecordTriggerType: string | null;
  IsActive: boolean;
  IsTemplate: boolean;
  RunInMode: string;
  LastModifiedDate: string;
  LastModifiedById: string;
}

/**
 * FlowDefinition — parent of Flow versions, owns DeveloperName
 */
export interface FlowDefinition {
  Id: string;
  DeveloperName: string;
  MasterLabel: string;
  NamespacePrefix: string | null;
  ActiveVersionId: string | null;
  LatestVersionId: string | null;
  Description: string | null;
}

/**
 * Describe SObject result
 */
export interface DescribeSObjectResult {
  name: string;
  label: string;
  labelPlural: string;
  keyPrefix: string;
  custom: boolean;
  customSetting: boolean;
  createable: boolean;
  updateable: boolean;
  deletable: boolean;
  queryable: boolean;
  searchable: boolean;
  layoutable: boolean;
  triggerable: boolean;
  fields: DescribeFieldResult[];
  recordTypeInfos?: RecordTypeInfo[];
  childRelationships?: ChildRelationship[];
}

/**
 * Describe Field result
 */
export interface DescribeFieldResult {
  name: string;
  label: string;
  type: string;
  length: number;
  precision?: number;
  scale?: number;
  nillable: boolean;
  unique: boolean;
  createable: boolean;
  updateable: boolean;
  filterable: boolean;
  sortable: boolean;
  groupable: boolean;
  custom: boolean;
  calculated: boolean;
  formulaTreatNullNumberAsZero?: boolean;
  defaultValue?: unknown;
  inlineHelpText?: string;
  picklistValues?: PicklistEntry[];
  referenceTo?: string[];
  relationshipName?: string;
  relationshipOrder?: number;
}

/**
 * Picklist Entry
 */
export interface PicklistEntry {
  value: string;
  label: string;
  active: boolean;
  defaultValue: boolean;
}

/**
 * Record Type Info
 */
export interface RecordTypeInfo {
  recordTypeId: string;
  name: string;
  developerName: string;
  available: boolean;
  master: boolean;
  defaultRecordTypeMapping: boolean;
}

/**
 * Child Relationship
 */
export interface ChildRelationship {
  childSObject: string;
  field: string;
  relationshipName: string;
  cascadeDelete: boolean;
  deprecatedAndHidden: boolean;
  junctionIdListNames?: string[];
  junctionReferenceTo?: string[];
  restrictedDelete: boolean;
}

/**
 * Salesforce defaults
 */
export const SF_DEFAULTS = {
  ORG_ALIAS: "production",
  API_VERSION: "59.0",
} as const;
