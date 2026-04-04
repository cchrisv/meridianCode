/**
 * Microsoft Graph Team Member Types
 * Types for org hierarchy discovery via Microsoft Graph API
 */

/**
 * Graph API base URL
 */
export const GRAPH_API_BASE = "https://graph.microsoft.com/v1.0";

/**
 * Fields selected from Graph user objects
 */
export const GRAPH_USER_SELECT =
  "displayName,jobTitle,mail,userPrincipalName,id,department,accountEnabled";

/**
 * Relationship of a team member to the logged-in user
 */
export type TeamRelationship =
  | "You"
  | "Your Manager"
  | "Peer"
  | "Peer's Team"
  | "Subordinate"
  | "Department"
  | "Leader"
  | "Team Member";

/**
 * Minimal Graph user object (from $select)
 */
export interface GraphUser {
  id: string;
  displayName: string;
  jobTitle: string | null;
  mail: string | null;
  userPrincipalName: string;
  department: string | null;
  accountEnabled?: boolean;
}

/**
 * Graph user with optional manager reference
 */
export interface GraphUserWithManager extends GraphUser {
  manager?: GraphManagerRef | null;
}

/**
 * Lightweight manager reference ($select=displayName,mail,id)
 */
export interface GraphManagerRef {
  id: string;
  displayName: string;
  mail: string | null;
}

/**
 * OData collection response from Graph
 */
export interface GraphCollection<T> {
  value: T[];
  "@odata.nextLink"?: string;
}

/**
 * Flattened team member record for output
 */
export interface TeamMember {
  name: string;
  title: string;
  email: string;
  manager: string;
  managerEmail: string;
  department: string;
  relationship: TeamRelationship;
  /** Salesforce enrichment (populated when --salesforce flag used) */
  salesforce?: {
    isSalesforceUser: boolean;
    username?: string;
    federationId?: string;
    profile?: string;
    role?: string;
    umgcDepartment?: string;
    lastLoginDate?: string;
    createdDate?: string;
    alias?: string;
    departmentLicense?: string;
    sfDepartment?: string;
    /** Success Team memberships from Success_Team_Member__c */
    teams?: {
      teamName: string;
      departmentName: string;
      type: string;
      title: string;
      totalHours: number;
    }[];
  };
}

/**
 * Options for team member discovery
 */
export interface TeamDiscoveryOptions {
  /** Team leader email — roots tree at this person instead of /me */
  leaderEmail?: string;
  /** Include all members of the user's department */
  includeDepartment?: boolean;
  /** Enrich with Salesforce user data (profile, role, etc.) */
  enrichSalesforce?: boolean;
  /** Output directory for reports (CSV / markdown) */
  outputDir?: string;
  /** Export CSV file */
  exportCsv?: boolean;
  /** Export markdown with Mermaid org chart */
  exportMarkdown?: boolean;
}

/**
 * Result returned by discoverTeamMembers()
 */
export interface TeamDiscoveryResult {
  success: boolean;
  message: string;
  currentUser: string;
  leader?: string;
  department: string;
  members: TeamMember[];
  summary: TeamDiscoverySummary;
  files: string[];
}

/**
 * Summary counts by relationship type
 */
export interface TeamDiscoverySummary {
  total: number;
  managers: number;
  peers: number;
  peerTeam: number;
  subordinates: number;
  department: number;
  withManager: number;
  withoutManager: number;
}
