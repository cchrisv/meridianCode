/**
 * Azure DevOps Wiki Pages
 * Operations for managing wiki pages
 *
 * NOTE: The azure-devops-node-api package has limited wiki page support.
 * It only provides stream-based methods (getPageText, getPageZip) not JSON responses.
 * We use direct REST API calls for all page operations.
 * See: https://github.com/microsoft/azure-devops-node-api/issues/416
 */

import { readFileSync } from "fs";
import { basename } from "path";
import type { WikiPage as AdoWikiPage } from "azure-devops-node-api/interfaces/WikiInterfaces.js";
import { getAzureBearerToken, validateAzureAuth } from "./lib/authAzureCli.js";
import { retryWithBackoff, RETRY_PRESETS } from "./lib/retryWithBackoff.js";
import { logInfo, logDebug, logError, createTimer } from "./lib/loggerStructured.js";
import { DEFAULT_ADO_ORG, DEFAULT_ADO_PROJECT } from "./types/adoFieldTypes.js";
import type { AdoConnectionConfig } from "./adoClient.js";
import type {
  WikiPage,
  WikiPageWithContent,
  WikiSearchResult,
  WikiSearchResponse,
  GetWikiPageOptions,
  UpdateWikiPageOptions,
  CreateWikiPageOptions,
  WikiPageUpdateResult,
  WikiAttachment,
  UploadWikiAttachmentOptions,
  WikiAttachmentUploadResult,
} from "./types/adoWikiTypes.js";
import { WIKI_DEFAULTS } from "./types/adoWikiTypes.js";

/**
 * Response from wiki page create/update REST API
 */
interface WikiPageCreateUpdateResponse {
  page: AdoWikiPage;
  eTag: string;
}

/**
 * Response from wiki page GET REST API (includes eTag from headers)
 */
interface WikiPageGetResponse {
  page: AdoWikiPage;
  eTag: string;
}

/**
 * Response from wiki attachment upload REST API
 */
interface WikiAttachmentCreateResponse {
  attachment: WikiAttachment;
  eTag: string;
}

/**
 * Get authorization headers for REST API calls
 */
function getAuthHeaders(contentType = "application/json"): Record<string, string> {
  validateAzureAuth();
  const token = getAzureBearerToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": contentType,
  };
}

/**
 * Build REST API URL for wiki pages
 */
function buildWikiPageUrl(
  orgUrl: string,
  project: string,
  wikiIdentifier: string,
  path: string,
  queryParams?: Record<string, string | number | boolean | undefined>,
): string {
  const baseUrl = `${orgUrl}/${encodeURIComponent(project)}/_apis/wiki/wikis/${encodeURIComponent(wikiIdentifier)}/pages`;
  const params = new URLSearchParams();
  params.set("path", path);
  params.set("api-version", "7.1");

  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined) {
        params.set(key, String(value));
      }
    }
  }

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Convert ADO Wiki page to our WikiPage type
 */
function convertWikiPage(page: AdoWikiPage): WikiPage {
  return {
    id: page.id ?? 0,
    path: page.path ?? "",
    url: page.url ?? "",
    remoteUrl: page.remoteUrl ?? "",
    gitItemPath: page.gitItemPath,
    content: page.content,
    order: page.order,
    isParentPage: page.isParentPage,
    subPages: page.subPages?.map(convertWikiPage),
  };
}

/**
 * Get wiki identifier (name or ID)
 */
function getWikiIdentifier(wikiId: string | undefined): string {
  return wikiId ?? WIKI_DEFAULTS.WIKI_NAME;
}

/**
 * Make a REST API call to get a wiki page
 */
async function getPageRest(
  orgUrl: string,
  project: string,
  wikiIdentifier: string,
  path: string,
  options?: {
    includeContent?: boolean;
    recursionLevel?: number;
  },
): Promise<WikiPageGetResponse> {
  const headers = getAuthHeaders();

  const queryParams: Record<string, string | number | boolean | undefined> = {
    includeContent: options?.includeContent ?? true,
    recursionLevel: options?.recursionLevel,
  };

  const url = buildWikiPageUrl(orgUrl, project, wikiIdentifier, path, queryParams);

  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Wiki API error (${response.status}): ${errorText}`);
  }

  const page = (await response.json()) as AdoWikiPage;
  const responseETag = response.headers.get("ETag") ?? "";
  return { page, eTag: responseETag };
}

/**
 * Make a REST API call to get a wiki page by ID
 */
async function getPageByIdRest(
  orgUrl: string,
  project: string,
  wikiIdentifier: string,
  pageId: number,
  options?: {
    includeContent?: boolean;
    recursionLevel?: number;
  },
): Promise<WikiPageGetResponse> {
  const headers = getAuthHeaders();

  const params = new URLSearchParams();
  params.set("api-version", "7.1");
  if (options?.includeContent !== undefined) {
    params.set("includeContent", String(options.includeContent));
  } else {
    params.set("includeContent", "true");
  }
  if (options?.recursionLevel !== undefined) {
    params.set("recursionLevel", String(options.recursionLevel));
  }

  const url = `${orgUrl}/${encodeURIComponent(project)}/_apis/wiki/wikis/${encodeURIComponent(wikiIdentifier)}/pages/${pageId}?${params.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Wiki API error (${response.status}): ${errorText}`);
  }

  const page = (await response.json()) as AdoWikiPage;
  const responseETag = response.headers.get("ETag") ?? "";
  return { page, eTag: responseETag };
}

/**
 * Make a REST API call to update a wiki page by ID (PATCH endpoint)
 * Uses the Pages - Update Page By Id endpoint which only updates existing pages
 */
async function updatePageByIdRest(
  orgUrl: string,
  project: string,
  wikiIdentifier: string,
  pageId: number,
  content: string,
  comment?: string,
  eTag?: string,
): Promise<WikiPageCreateUpdateResponse> {
  const headers = getAuthHeaders();

  if (eTag) {
    headers["If-Match"] = eTag;
  }

  const params = new URLSearchParams();
  params.set("api-version", "7.1");
  if (comment) {
    params.set("comment", comment);
  }

  const url = `${orgUrl}/${encodeURIComponent(project)}/_apis/wiki/wikis/${encodeURIComponent(wikiIdentifier)}/pages/${pageId}?${params.toString()}`;

  const response = await fetch(url, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Wiki API error (${response.status}): ${errorText}`);
  }

  const page = (await response.json()) as AdoWikiPage;
  const responseETag = response.headers.get("ETag") ?? "";

  return {
    page,
    eTag: responseETag,
  };
}

/**
 * Make a REST API call to create or update a wiki page
 */
async function createOrUpdatePageRest(
  orgUrl: string,
  project: string,
  wikiIdentifier: string,
  path: string,
  content: string,
  comment?: string,
  eTag?: string,
): Promise<WikiPageCreateUpdateResponse> {
  const headers = getAuthHeaders();

  if (eTag) {
    headers["If-Match"] = eTag;
  }

  const params = new URLSearchParams();
  params.set("path", path);
  params.set("api-version", "7.1");
  if (comment) {
    params.set("comment", comment);
  }

  const url = `${orgUrl}/${encodeURIComponent(project)}/_apis/wiki/wikis/${encodeURIComponent(wikiIdentifier)}/pages?${params.toString()}`;

  const response = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Wiki API error (${response.status}): ${errorText}`);
  }

  const page = (await response.json()) as AdoWikiPage;
  const responseETag = response.headers.get("ETag") ?? "";

  return {
    page,
    eTag: responseETag,
  };
}

/**
 * Make a REST API call to delete a wiki page
 */
async function deletePageRest(
  orgUrl: string,
  project: string,
  wikiIdentifier: string,
  path: string,
): Promise<void> {
  const headers = getAuthHeaders();

  const params = new URLSearchParams();
  params.set("path", path);
  params.set("api-version", "7.1");

  const url = `${orgUrl}/${encodeURIComponent(project)}/_apis/wiki/wikis/${encodeURIComponent(wikiIdentifier)}/pages?${params.toString()}`;

  const response = await fetch(url, {
    method: "DELETE",
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Wiki API error (${response.status}): ${errorText}`);
  }
}

/**
 * Make a REST API call to upload a wiki attachment
 */
async function uploadAttachmentRest(
  orgUrl: string,
  project: string,
  wikiIdentifier: string,
  name: string,
  fileContent: Buffer,
): Promise<WikiAttachmentCreateResponse> {
  const headers = getAuthHeaders("application/octet-stream");
  const encodedContent = fileContent.toString("base64");

  const params = new URLSearchParams();
  params.set("name", name);
  params.set("api-version", "7.1");

  const url = `${orgUrl}/${encodeURIComponent(project)}/_apis/wiki/wikis/${encodeURIComponent(wikiIdentifier)}/attachments?${params.toString()}`;

  const response = await fetch(url, {
    method: "PUT",
    headers,
    body: encodedContent,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Wiki attachment API error (${response.status}): ${errorText}`);
  }

  const attachment = (await response.json()) as WikiAttachment;
  const responseETag = response.headers.get("ETag") ?? "";

  return {
    attachment,
    eTag: responseETag,
  };
}

/**
 * Get a wiki page by path
 *
 * @param options - Get options
 * @param config - Connection config
 * @returns Wiki page
 */
export async function getWikiPage(
  options: GetWikiPageOptions,
  config?: AdoConnectionConfig,
): Promise<WikiPageWithContent> {
  const timer = createTimer();
  const { path, pageId, includeContent = true, recursionLevel } = options;

  if (!path && pageId === undefined) {
    throw new Error("Either page path or page ID must be specified");
  }

  const orgUrl = config?.orgUrl ?? DEFAULT_ADO_ORG;
  const project = config?.project ?? DEFAULT_ADO_PROJECT;
  const wikiIdentifier = getWikiIdentifier(options.wikiId);

  let getResult: WikiPageGetResponse;

  if (pageId !== undefined) {
    logInfo(`Getting wiki page by ID: ${pageId}`);
    getResult = await retryWithBackoff(
      () =>
        getPageByIdRest(orgUrl, project, wikiIdentifier, pageId, {
          includeContent,
          recursionLevel: recursionLevel as number | undefined,
        }),
      { ...RETRY_PRESETS.standard, operationName: `getWikiPage(id:${pageId})` },
    );
  } else {
    logInfo(`Getting wiki page: ${path}`);
    getResult = await retryWithBackoff(
      () =>
        getPageRest(orgUrl, project, wikiIdentifier, path!, {
          includeContent,
          recursionLevel: recursionLevel as number | undefined,
        }),
      { ...RETRY_PRESETS.standard, operationName: `getWikiPage(${path})` },
    );
  }

  if (!getResult?.page) {
    throw new Error(`Wiki page ${pageId !== undefined ? `id:${pageId}` : path} not found`);
  }

  const result: WikiPageWithContent = {
    ...convertWikiPage(getResult.page),
    content: getResult.page.content ?? "",
    eTag: getResult.eTag || undefined,
  };

  const label = pageId !== undefined ? `id:${pageId}` : path;
  timer.log(`getWikiPage(${label})`);
  return result;
}

/**
 * Update a wiki page
 *
 * @param options - Update options
 * @param config - Connection config
 * @returns Update result with new page and eTag
 */
export async function updateWikiPage(
  options: UpdateWikiPageOptions,
  config?: AdoConnectionConfig,
): Promise<WikiPageUpdateResult> {
  const timer = createTimer();
  const { path, pageId, content, comment, eTag } = options;

  if (!path && pageId === undefined) {
    throw new Error("Either page path or page ID is required for updates");
  }

  // Load content from file if it's a file path
  let pageContent = content;
  if (content.endsWith(".md") || content.includes("/") || content.includes("\\")) {
    try {
      logDebug(`Loading content from file: ${content}`);
      pageContent = readFileSync(content, "utf-8");
    } catch {
      // Not a file, use as raw content
      logDebug("Content is not a file path, using as raw content");
    }
  }

  const orgUrl = config?.orgUrl ?? DEFAULT_ADO_ORG;
  const project = config?.project ?? DEFAULT_ADO_PROJECT;
  const wikiIdentifier = getWikiIdentifier(options.wikiId);

  // Update by page ID uses the PATCH endpoint (only updates existing pages, never creates)
  if (pageId !== undefined) {
    logInfo(`Updating wiki page by ID: ${pageId}`);

    // Get current eTag if not provided
    let currentETag = eTag;
    if (!currentETag) {
      try {
        const currentPage = await getWikiPage({ pageId, wikiId: options.wikiId }, config);
        currentETag = currentPage.eTag;
      } catch {
        logDebug("Could not get current page eTag, will attempt update without it");
      }
    }

    const result = await retryWithBackoff(
      () =>
        updatePageByIdRest(
          orgUrl,
          project,
          wikiIdentifier,
          pageId,
          pageContent,
          comment ?? "Updated via API",
          currentETag,
        ),
      { ...RETRY_PRESETS.standard, operationName: `updateWikiPage(id:${pageId})` },
    );

    logInfo(`Successfully updated wiki page ID: ${pageId}`);
    timer.log(`updateWikiPage(id:${pageId})`);

    return {
      page: convertWikiPage(result.page),
      eTag: result.eTag,
    };
  }

  // Update by path uses the PUT endpoint (create-or-update)
  logInfo(`Updating wiki page: ${path}`);

  // Get current page to get eTag if not provided
  let currentETag = eTag;
  if (!currentETag) {
    try {
      const currentPage = await getWikiPage({ path, wikiId: options.wikiId }, config);
      currentETag = currentPage.eTag;
    } catch {
      // Page might not exist yet
      logDebug("Could not get current page eTag, will attempt update without it");
    }
  }

  const result = await retryWithBackoff(
    () =>
      createOrUpdatePageRest(
        orgUrl,
        project,
        wikiIdentifier,
        path!,
        pageContent,
        comment ?? "Updated via API",
        currentETag,
      ),
    { ...RETRY_PRESETS.standard, operationName: `updateWikiPage(${path})` },
  );

  logInfo(`Successfully updated wiki page: ${path}`);
  timer.log(`updateWikiPage(${path})`);

  return {
    page: convertWikiPage(result.page),
    eTag: result.eTag,
  };
}

/**
 * Create a new wiki page
 *
 * @param options - Create options
 * @param config - Connection config
 * @returns Created page with eTag
 */
export async function createWikiPage(
  options: CreateWikiPageOptions,
  config?: AdoConnectionConfig,
): Promise<WikiPageUpdateResult> {
  const timer = createTimer();
  const { path, content, comment } = options;

  logInfo(`Creating wiki page: ${path}`);

  // Load content from file if it's a file path
  let pageContent = content;
  if (content.endsWith(".md") || content.includes("/") || content.includes("\\")) {
    try {
      logDebug(`Loading content from file: ${content}`);
      pageContent = readFileSync(content, "utf-8");
    } catch {
      // Not a file, use as raw content
      logDebug("Content is not a file path, using as raw content");
    }
  }

  const orgUrl = config?.orgUrl ?? DEFAULT_ADO_ORG;
  const project = config?.project ?? DEFAULT_ADO_PROJECT;
  const wikiIdentifier = getWikiIdentifier(options.wikiId);

  const result = await retryWithBackoff(
    () =>
      createOrUpdatePageRest(
        orgUrl,
        project,
        wikiIdentifier,
        path,
        pageContent,
        comment ?? "Created via API",
        // No eTag for new pages
      ),
    { ...RETRY_PRESETS.standard, operationName: `createWikiPage(${path})` },
  );

  logInfo(`Successfully created wiki page: ${path}`);
  timer.log(`createWikiPage(${path})`);

  return {
    page: convertWikiPage(result.page),
    eTag: result.eTag,
  };
}

/**
 * Upload a wiki attachment and return the markdown reference for it
 *
 * @param options - Upload options
 * @param config - Connection config
 * @returns Uploaded attachment details, eTag, and markdown reference
 */
export async function uploadWikiAttachment(
  options: UploadWikiAttachmentOptions,
  config?: AdoConnectionConfig,
): Promise<WikiAttachmentUploadResult> {
  const timer = createTimer();
  const fileName = options.name ?? basename(options.filePath);

  logInfo(`Uploading wiki attachment: ${fileName}`);

  const fileContent = readFileSync(options.filePath);
  const orgUrl = config?.orgUrl ?? DEFAULT_ADO_ORG;
  const project = config?.project ?? DEFAULT_ADO_PROJECT;
  const wikiIdentifier = getWikiIdentifier(options.wikiId);

  const result = await retryWithBackoff(
    () => uploadAttachmentRest(orgUrl, project, wikiIdentifier, fileName, fileContent),
    { ...RETRY_PRESETS.standard, operationName: `uploadWikiAttachment(${fileName})` },
  );

  logInfo(`Successfully uploaded wiki attachment: ${result.attachment.path}`);
  timer.log(`uploadWikiAttachment(${fileName})`);

  return {
    attachment: result.attachment,
    eTag: result.eTag,
    markdown: `![${result.attachment.name}](${result.attachment.path})`,
  };
}

/**
 * Delete a wiki page
 *
 * @param path - Page path
 * @param wikiId - Wiki identifier (optional)
 * @param config - Connection config
 */
export async function deleteWikiPage(
  path: string,
  wikiId?: string,
  config?: AdoConnectionConfig,
): Promise<void> {
  const timer = createTimer();

  logInfo(`Deleting wiki page: ${path}`);

  const orgUrl = config?.orgUrl ?? DEFAULT_ADO_ORG;
  const project = config?.project ?? DEFAULT_ADO_PROJECT;
  const wikiIdentifier = getWikiIdentifier(wikiId);

  await retryWithBackoff(() => deletePageRest(orgUrl, project, wikiIdentifier, path), {
    ...RETRY_PRESETS.standard,
    operationName: `deleteWikiPage(${path})`,
  });

  logInfo(`Successfully deleted wiki page: ${path}`);
  timer.log(`deleteWikiPage(${path})`);
}

/**
 * Search wiki pages using ADO Search API (content + title search)
 * Paginates through ALL results — the LLM consumer determines relevance.
 *
 * @param searchText - Text to search for in page content and titles
 * @param wikiId - Wiki identifier (optional, defaults to project wiki)
 * @param config - Connection config
 * @returns WikiSearchResponse with totalCount and all deduplicated results
 */
export async function searchWikiPages(
  searchText: string,
  wikiId?: string,
  config?: AdoConnectionConfig,
): Promise<WikiSearchResponse> {
  const timer = createTimer();
  const MAX_HIGHLIGHT_LENGTH = 300;
  const MAX_HIGHLIGHTS_PER_RESULT = 3;
  const PAGE_SIZE = 200; // ADO Search API max per request

  logInfo(`Searching wiki for: ${searchText}`);

  try {
    const orgUrl = config?.orgUrl ?? DEFAULT_ADO_ORG;
    const project = config?.project ?? DEFAULT_ADO_PROJECT;

    // ADO Search API uses almsearch.dev.azure.com
    const searchOrgUrl = orgUrl.replace("dev.azure.com", "almsearch.dev.azure.com");
    const url = `${searchOrgUrl}/${encodeURIComponent(project)}/_apis/search/wikisearchresults?api-version=7.1-preview.1`;

    // Default to project wiki if no wikiId specified
    const effectiveWikiId = wikiId ?? WIKI_DEFAULTS.WIKI_NAME;

    const seenPaths = new Set<string>();
    const results: WikiSearchResult[] = [];
    let totalCount = 0;
    let skip = 0;

    // Paginate through all results
    while (true) {
      const headers = getAuthHeaders();
      headers["Content-Type"] = "application/json";

      const body: Record<string, unknown> = {
        searchText,
        $top: PAGE_SIZE,
        $skip: skip,
      };
      body["filters"] = { Wiki: [effectiveWikiId] };

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Wiki Search API error (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as {
        count: number;
        results: Array<{
          fileName: string;
          path: string;
          wiki: { name: string; id: string };
          hits: Array<{
            fieldReferenceName: string;
            highlights: string[];
          }>;
        }>;
      };

      totalCount = data.count;
      const pageResults = data.results ?? [];
      if (pageResults.length === 0) break;

      for (const r of pageResults) {
        // Normalize git path → wiki page path:
        // In ADO wiki git: literal "-" = space in page name, "%2D" = actual hyphen
        const wikiPath = decodeURIComponent(r.path.replace(/-/g, " ")).replace(/\.md$/i, "");
        if (seenPaths.has(wikiPath)) continue;
        seenPaths.add(wikiPath);

        // Collect content highlights, strip HTML tags, truncate
        const highlights: string[] = [];
        for (const hit of r.hits ?? []) {
          if (
            hit.fieldReferenceName === "content" ||
            hit.fieldReferenceName === "content.pattern"
          ) {
            for (const h of hit.highlights) {
              if (highlights.length >= MAX_HIGHLIGHTS_PER_RESULT) break;
              const clean = h.replace(/<\/?highlighthit>/g, "");
              highlights.push(
                clean.length > MAX_HIGHLIGHT_LENGTH
                  ? clean.substring(0, MAX_HIGHLIGHT_LENGTH) + "..."
                  : clean,
              );
            }
          }
          if (highlights.length >= MAX_HIGHLIGHTS_PER_RESULT) break;
        }

        results.push({
          fileName: r.fileName,
          path: wikiPath,
          wiki: r.wiki,
          highlights,
        });
      }

      skip += pageResults.length;
      if (skip >= totalCount) break;

      logDebug(`Fetched ${skip}/${totalCount} search results...`);
    }

    logDebug(
      `Found ${totalCount} total, ${results.length} unique wiki pages matching "${searchText}"`,
    );
    timer.log(`searchWikiPages(${searchText})`);

    return { totalCount, results };
  } catch (error) {
    logError(`Wiki search failed: ${error instanceof Error ? error.message : error}`);
    return { totalCount: 0, results: [] };
  }
}

/**
 * Get all wiki pages recursively
 */
async function getAllWikiPagesRecursive(
  path: string,
  wikiId?: string,
  config?: AdoConnectionConfig,
): Promise<WikiPage[]> {
  const orgUrl = config?.orgUrl ?? DEFAULT_ADO_ORG;
  const project = config?.project ?? DEFAULT_ADO_PROJECT;
  const wikiIdentifier = getWikiIdentifier(wikiId);

  const getResult = await retryWithBackoff(
    () =>
      getPageRest(orgUrl, project, wikiIdentifier, path, {
        includeContent: false,
        recursionLevel: 120, // Full recursion (OneLevel=1, Full=120)
      }),
    { ...RETRY_PRESETS.standard, operationName: `getAllWikiPages(${path})` },
  );

  if (!getResult?.page) {
    return [];
  }

  const page = getResult.page;
  const result: WikiPage[] = [];

  // Add current page if it has valid content
  if (page.path && page.path !== "/") {
    result.push(convertWikiPage(page));
  }

  // Recursively add subpages
  function collectSubPages(p: AdoWikiPage) {
    if (p.subPages) {
      for (const subPage of p.subPages) {
        result.push(convertWikiPage(subPage));
        collectSubPages(subPage);
      }
    }
  }
  collectSubPages(page);

  return result;
}

/**
 * List wiki pages under a path
 *
 * @param path - Parent path (optional, defaults to root)
 * @param wikiId - Wiki identifier (optional)
 * @param config - Connection config
 * @returns Array of wiki pages
 */
export async function listWikiPages(
  path?: string,
  wikiId?: string,
  config?: AdoConnectionConfig,
): Promise<WikiPage[]> {
  const timer = createTimer();
  const pagePath = path ?? "/";

  logInfo(`Listing wiki pages under: ${pagePath}`);

  const orgUrl = config?.orgUrl ?? DEFAULT_ADO_ORG;
  const project = config?.project ?? DEFAULT_ADO_PROJECT;
  const wikiIdentifier = getWikiIdentifier(wikiId);

  const getResult = await retryWithBackoff(
    () =>
      getPageRest(orgUrl, project, wikiIdentifier, pagePath, {
        includeContent: false,
        recursionLevel: 1, // OneLevel
      }),
    { ...RETRY_PRESETS.standard, operationName: `listWikiPages(${pagePath})` },
  );

  if (!getResult?.page) {
    return [];
  }

  const result = getResult.page.subPages?.map(convertWikiPage) ?? [];

  logDebug(`Found ${result.length} wiki pages under ${pagePath}`);
  timer.log(`listWikiPages(${pagePath})`);

  return result;
}
