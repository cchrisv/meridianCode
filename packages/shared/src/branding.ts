/**
 * User-facing product naming. Package scope (@t3tools), CLI (`t3`), and env
 * (`T3CODE_*`) stay stable for compatibility.
 */
export const APP_BASE_NAME = "Meridian Code" as const;

/** Menus / truncation where the full name is too long. */
export const APP_SHORT_NAME = "Meridian" as const;

export const APP_STAGE_LABEL_PRODUCTION = "Alpha" as const;
export const APP_STAGE_LABEL_DEVELOPMENT = "Dev" as const;

export function appDisplayName(isDevelopment: boolean): string {
  const stage = isDevelopment ? APP_STAGE_LABEL_DEVELOPMENT : APP_STAGE_LABEL_PRODUCTION;
  return `${APP_BASE_NAME} (${stage})`;
}
