/**
 * Azure DevOps Link Types
 * Type definitions for work item relationships
 */

/**
 * Standard link type names
 */
export type LinkTypeName =
  | "System.LinkTypes.Hierarchy-Forward" // Parent
  | "System.LinkTypes.Hierarchy-Reverse" // Child
  | "System.LinkTypes.Related" // Related
  | "System.LinkTypes.Dependency-Forward" // Successor
  | "System.LinkTypes.Dependency-Reverse" // Predecessor
  | "Microsoft.VSTS.Common.Affects-Forward"
  | "Microsoft.VSTS.Common.Affects-Reverse"
  | "System.LinkTypes.Duplicate-Forward"
  | "System.LinkTypes.Duplicate-Reverse";

/**
 * User-friendly link type aliases
 */
export type LinkTypeAlias =
  | "parent"
  | "child"
  | "related"
  | "predecessor"
  | "successor"
  | "duplicate"
  | "affects";

/**
 * Mapping from friendly names to system link types
 */
export const LINK_TYPE_MAP: Record<LinkTypeAlias, LinkTypeName> = {
  parent: "System.LinkTypes.Hierarchy-Forward",
  child: "System.LinkTypes.Hierarchy-Reverse",
  related: "System.LinkTypes.Related",
  predecessor: "System.LinkTypes.Dependency-Reverse",
  successor: "System.LinkTypes.Dependency-Forward",
  duplicate: "System.LinkTypes.Duplicate-Forward",
  affects: "Microsoft.VSTS.Common.Affects-Forward",
} as const;

/**
 * Reverse mapping from system link types to friendly names
 */
export const LINK_TYPE_REVERSE_MAP: Record<LinkTypeName, LinkTypeAlias> = {
  "System.LinkTypes.Hierarchy-Forward": "parent",
  "System.LinkTypes.Hierarchy-Reverse": "child",
  "System.LinkTypes.Related": "related",
  "System.LinkTypes.Dependency-Reverse": "predecessor",
  "System.LinkTypes.Dependency-Forward": "successor",
  "System.LinkTypes.Duplicate-Forward": "duplicate",
  "System.LinkTypes.Duplicate-Reverse": "duplicate",
  "Microsoft.VSTS.Common.Affects-Forward": "affects",
  "Microsoft.VSTS.Common.Affects-Reverse": "affects",
} as const;

/**
 * Options for linking work items
 */
export interface LinkWorkItemsOptions {
  sourceId: number;
  targetId: number;
  linkType: LinkTypeAlias;
  comment?: string;
}

/**
 * Options for getting work item relations
 */
export interface GetRelationsOptions {
  workItemId: number;
  linkTypes?: LinkTypeAlias[];
}

/**
 * Relation result
 */
export interface RelationResult {
  workItemId: number;
  relations: ParsedRelation[];
}

/**
 * Parsed relation with friendly names
 */
export interface ParsedRelation {
  targetId: number;
  linkType: LinkTypeAlias;
  linkTypeName: LinkTypeName;
  url: string;
  comment?: string;
}

/**
 * Helper to resolve link type alias to system name
 */
export function resolveLinkType(alias: LinkTypeAlias): LinkTypeName {
  return LINK_TYPE_MAP[alias];
}

/**
 * Helper to parse link type name to alias
 */
export function parseLinkType(name: string): LinkTypeAlias | undefined {
  return LINK_TYPE_REVERSE_MAP[name as LinkTypeName];
}

/**
 * Extract work item ID from relation URL
 */
export function extractWorkItemIdFromUrl(url: string): number | undefined {
  const match = /\/workItems\/(\d+)$/.exec(url);
  return match ? parseInt(match[1], 10) : undefined;
}
