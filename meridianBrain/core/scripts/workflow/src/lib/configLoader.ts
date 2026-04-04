/**
 * Configuration Loader
 * Loads and validates configuration files (Meridian: core/config/shared.json).
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import type { SharedConfig, TemplateVariables } from "../types/configTypes.js";

/**
 * Meridian repo root: directory containing core/config/shared.json.
 * Walks up from cwd (so CLIs work inside core/scripts/workflow) and from this file.
 */
export function getProjectRoot(): string {
  /** Meridian repository root only — must not match the content pillar folder `.../core`. */
  const markers: Array<(root: string) => boolean> = [
    (root) => existsSync(resolve(root, "core", "config", "shared.json")),
  ];

  let dir = resolve(process.cwd());
  for (let i = 0; i < 12; i++) {
    if (markers.some((m) => m(dir))) return dir;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }

  const fromSource = dirname(fileURLToPath(import.meta.url));
  dir = resolve(fromSource, "..", "..", "..", "..", "..");
  for (let i = 0; i < 6; i++) {
    if (markers.some((m) => m(dir))) return dir;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }

  return process.cwd();
}

function getConfigDir(): string {
  return resolve(getProjectRoot(), "core", "config");
}

function loadJsonFile<T>(filePath: string): T {
  if (!existsSync(filePath)) {
    throw new Error(`Configuration file not found: ${filePath}`);
  }

  try {
    const content = readFileSync(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
    }
    throw error;
  }
}

export function loadSharedConfig(configPath?: string): SharedConfig {
  const path = configPath ?? resolve(getConfigDir(), "shared.json");
  return loadJsonFile<SharedConfig>(path);
}

export function loadTemplateVariables(configPath?: string): TemplateVariables {
  const path = configPath ?? resolve(getConfigDir(), "template-variables.json");

  if (!existsSync(path)) {
    return {};
  }

  return loadJsonFile<TemplateVariables>(path);
}

export function getCliCommand(
  commandKey: keyof SharedConfig["cli_commands"],
  configPath?: string,
): string {
  const config = loadSharedConfig(configPath) as unknown as SharedConfig & {
    cli_commands: Record<string, string>;
  };
  const command = config.cli_commands[commandKey as string];

  if (!command) {
    throw new Error(`CLI command not found: ${String(commandKey)}`);
  }

  return command;
}

export function resolveTemplate(template: string, variables: TemplateVariables): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = variables[key];
    if (value === undefined) {
      return match;
    }
    return String(value);
  });
}

export function mergeVariables(
  base: TemplateVariables,
  overrides: TemplateVariables,
): TemplateVariables {
  return { ...base, ...overrides };
}

const PROMPT_SUBDIRS = [
  "core",
  "shared",
  "platforms/crm",
  "platforms/marketing-automation",
  "platforms/contact-center",
  "platforms/portal",
] as const;

/**
 * Resolve a prompt file under .github/prompts (nested Meridian layout).
 */
export function getPromptPath(promptName: string): string {
  const base = resolve(getProjectRoot(), ".github", "prompts");
  const baseName = promptName.endsWith(".prompt.md") ? promptName : `${promptName}.prompt.md`;
  for (const sub of PROMPT_SUBDIRS) {
    const p = resolve(base, ...sub.split("/"), baseName);
    if (existsSync(p)) return p;
  }
  return resolve(base, "core", baseName);
}

/**
 * Primary Meridian template directory: core/templates (ADO + work item HTML).
 */
export function getTemplatePath(templateName: string): string {
  return resolve(getProjectRoot(), "core", "templates", templateName);
}

/**
 * Standards: core = shared org-wide, ado = core/standards, salesforce = CRM platform.
 */
export function getStandardPath(
  domain: "core" | "ado" | "salesforce",
  standardName: string,
): string {
  const root = getProjectRoot();
  if (domain === "core") {
    return resolve(root, "shared", "standards", standardName);
  }
  if (domain === "ado") {
    return resolve(root, "core", "standards", standardName);
  }
  return resolve(root, "platforms", "crm", "standards", standardName);
}
