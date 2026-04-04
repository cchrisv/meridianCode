import {
  APP_BASE_NAME,
  APP_STAGE_LABEL_DEVELOPMENT,
  APP_STAGE_LABEL_PRODUCTION,
  appDisplayName,
} from "@t3tools/shared/branding";

export {
  APP_BASE_NAME,
  APP_SHORT_NAME,
  APP_STAGE_LABEL_DEVELOPMENT,
  APP_STAGE_LABEL_PRODUCTION,
  appDisplayName,
} from "@t3tools/shared/branding";

export const APP_STAGE_LABEL = import.meta.env.DEV
  ? APP_STAGE_LABEL_DEVELOPMENT
  : APP_STAGE_LABEL_PRODUCTION;

export const APP_DISPLAY_NAME = appDisplayName(import.meta.env.DEV);

export const APP_VERSION = import.meta.env.APP_VERSION || "0.0.0";
