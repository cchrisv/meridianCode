/**
 * Azure DevOps Wiki Types
 * Type definitions for wiki operations
 */

/**
 * Wiki type
 */
export type WikiType = "projectWiki" | "codeWiki";

/**
 * Wiki information
 */
export interface Wiki {
  id: string;
  name: string;
  type: WikiType;
  url: string;
  projectId: string;
  repositoryId?: string;
  mappedPath?: string;
  version?: string;
}

/**
 * Wiki page
 */
export interface WikiPage {
  id: number;
  path: string;
  url: string;
  remoteUrl: string;
  gitItemPath?: string;
  content?: string;
  order?: number;
  isParentPage?: boolean;
  subPages?: WikiPage[];
}

/**
 * Wiki page with content
 */
export interface WikiPageWithContent extends WikiPage {
  content: string;
  eTag?: string;
}

/**
 * Options for getting a wiki page
 */
export interface GetWikiPageOptions {
  wikiId?: string;
  pageId?: number;
  path?: string;
  includeContent?: boolean;
  recursionLevel?: "None" | "OneLevel" | "Full";
  versionDescriptor?: {
    version?: string;
    versionType?: "branch" | "tag" | "commit";
  };
}

/**
 * Options for updating a wiki page
 */
export interface UpdateWikiPageOptions {
  wikiId?: string;
  pageId?: number;
  path?: string;
  content: string;
  comment?: string;
  eTag?: string;
}

/**
 * Options for creating a wiki page
 */
export interface CreateWikiPageOptions {
  wikiId?: string;
  path: string;
  content: string;
  comment?: string;
}

/**
 * Wiki page update result
 */
export interface WikiPageUpdateResult {
  page: WikiPage;
  eTag: string;
}

/**
 * Wiki attachment
 */
export interface WikiAttachment {
  name: string;
  path: string;
}

/**
 * Options for uploading a wiki attachment
 */
export interface UploadWikiAttachmentOptions {
  wikiId?: string;
  filePath: string;
  name?: string;
}

/**
 * Wiki attachment upload result
 */
export interface WikiAttachmentUploadResult {
  attachment: WikiAttachment;
  eTag: string;
  markdown: string;
}

/**
 * Wiki search result from ADO Search API
 */
export interface WikiSearchResult {
  fileName: string;
  path: string;
  wiki: { name: string; id: string };
  highlights: string[];
}

/**
 * Wiki search response with total count and results
 */
export interface WikiSearchResponse {
  totalCount: number;
  results: WikiSearchResult[];
}

/**
 * Wiki constants
 */
export const WIKI_DEFAULTS = {
  WIKI_NAME: "Digital Platforms Wiki",
  PROJECT: "Digital Platforms",
} as const;
