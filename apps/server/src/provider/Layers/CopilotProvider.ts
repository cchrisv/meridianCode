import type {
  CopilotSettings,
  ModelCapabilities,
  ServerProvider,
  ServerProviderModel,
} from "@t3tools/contracts";
import { APP_BASE_NAME } from "@t3tools/shared/branding";
import { CopilotClient, type ModelInfo } from "@github/copilot-sdk";
import { Data, Effect, Equal, Layer, Option, Result, Stream } from "effect";

import { ServerSettingsService } from "../../serverSettings.ts";
import { ServerSettingsError } from "@t3tools/contracts";
import { makeManagedServerProvider } from "../makeManagedServerProvider.ts";
import { resolveCopilotServerAuth } from "../copilotServerAuth.ts";
import {
  buildServerProvider,
  isCommandMissingCause,
  providerModelsFromSettings,
} from "../providerSnapshot.ts";
import { CopilotProvider } from "../Services/CopilotProvider.ts";
import { normalizeCopilotCliPathOverride, resolveBundledCopilotCliPath } from "./copilotCliPath.ts";

const PROVIDER = "copilot" as const;
const DEFAULT_TIMEOUT_MS = 4_000;

class CopilotSdkProbeError extends Data.TaggedError("CopilotSdkProbeError")<{
  readonly cause: unknown;
}> {}

function getCopilotHealthCheckTimeoutMs(platform: string = process.platform): number {
  return platform === "win32" ? 10_000 : DEFAULT_TIMEOUT_MS;
}

function mapModelInfoToServerModel(model: ModelInfo): ServerProviderModel {
  const efforts = model.supportedReasoningEfforts ?? [];
  const reasoningEffortLevels = efforts.map((value) => {
    const row: { value: typeof value; label: typeof value; isDefault?: true } = {
      value,
      label: value,
    };
    if (model.defaultReasoningEffort === value) {
      row.isDefault = true;
    }
    return row;
  });
  const capabilities: ModelCapabilities = {
    reasoningEffortLevels,
    supportsFastMode: false,
    supportsThinkingToggle: false,
    contextWindowOptions: [],
    promptInjectedEffortLevels: [],
  };
  return {
    slug: model.id,
    name: model.name,
    isCustom: false,
    capabilities,
  };
}

const BUILT_IN_MODELS: ReadonlyArray<ServerProviderModel> = [
  {
    slug: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    isCustom: false,
    capabilities: {
      reasoningEffortLevels: [
        { value: "xhigh", label: "Extra High" },
        { value: "high", label: "High", isDefault: true },
        { value: "medium", label: "Medium" },
        { value: "low", label: "Low" },
      ],
      supportsFastMode: false,
      supportsThinkingToggle: false,
      contextWindowOptions: [],
      promptInjectedEffortLevels: [],
    },
  },
  {
    slug: "gpt-5.4",
    name: "GPT-5.4",
    isCustom: false,
    capabilities: {
      reasoningEffortLevels: [
        { value: "xhigh", label: "Extra High" },
        { value: "high", label: "High", isDefault: true },
        { value: "medium", label: "Medium" },
        { value: "low", label: "Low" },
      ],
      supportsFastMode: false,
      supportsThinkingToggle: false,
      contextWindowOptions: [],
      promptInjectedEffortLevels: [],
    },
  },
];

export function getCopilotModelCapabilities(model: string | null | undefined): ModelCapabilities {
  const slug = model?.trim();
  return (
    BUILT_IN_MODELS.find((candidate) => candidate.slug === slug)?.capabilities ?? {
      reasoningEffortLevels: [
        { value: "xhigh", label: "Extra High" },
        { value: "high", label: "High", isDefault: true },
        { value: "medium", label: "Medium" },
        { value: "low", label: "Low" },
      ],
      supportsFastMode: false,
      supportsThinkingToggle: false,
      contextWindowOptions: [],
      promptInjectedEffortLevels: [],
    }
  );
}

export const checkCopilotProviderStatus = Effect.fn("checkCopilotProviderStatus")(
  function* (): Effect.fn.Return<ServerProvider, ServerSettingsError, ServerSettingsService> {
    const copilotSettings = yield* Effect.service(ServerSettingsService).pipe(
      Effect.flatMap((service) => service.getSettings),
      Effect.map((settings) => settings.providers.copilot),
    );
    const checkedAt = new Date().toISOString();
    const baseModels = providerModelsFromSettings(
      BUILT_IN_MODELS,
      PROVIDER,
      copilotSettings.customModels,
    );

    if (!copilotSettings.enabled) {
      return buildServerProvider({
        provider: PROVIDER,
        enabled: false,
        checkedAt,
        models: baseModels,
        probe: {
          installed: false,
          version: null,
          status: "warning",
          auth: { status: "unknown" },
          message: `GitHub Copilot is disabled in ${APP_BASE_NAME} settings.`,
        },
      });
    }

    const cliPath =
      normalizeCopilotCliPathOverride(copilotSettings.binaryPath) ?? resolveBundledCopilotCliPath();

    const sdkProbe = yield* Effect.tryPromise({
      try: async () => {
        const configTrim = copilotSettings.configDir.trim();
        const client = new CopilotClient({
          ...(cliPath ? { cliPath } : {}),
          logLevel: "error",
          ...(configTrim.length > 0
            ? { env: { ...process.env, GITHUB_COPILOT_CONFIG_DIR: configTrim } }
            : {}),
        });
        try {
          await client.start();
          const [authStatus, listedModels, status] = await Promise.all([
            client.getAuthStatus().catch(() => undefined),
            client.listModels().catch(() => undefined),
            client.getStatus().catch(() => undefined),
          ]);
          return { authStatus, listedModels, status };
        } finally {
          await client.stop().catch(() => []);
        }
      },
      catch: (cause) => new CopilotSdkProbeError({ cause }),
    }).pipe(Effect.timeoutOption(getCopilotHealthCheckTimeoutMs()), Effect.result);

    if (Result.isFailure(sdkProbe)) {
      const failure = sdkProbe.failure as unknown;
      const cause =
        typeof failure === "object" &&
        failure !== null &&
        "_tag" in failure &&
        (failure as { _tag: unknown })._tag === "CopilotSdkProbeError" &&
        "cause" in failure
          ? (failure as { cause: unknown }).cause
          : failure;
      return buildServerProvider({
        provider: PROVIDER,
        enabled: copilotSettings.enabled,
        checkedAt,
        models: baseModels,
        probe: {
          installed: !isCommandMissingCause(cause),
          version: null,
          status: "error",
          auth: { status: "unknown" },
          message: isCommandMissingCause(cause)
            ? "GitHub Copilot CLI is not installed or not discoverable."
            : `Failed to start GitHub Copilot health check: ${cause instanceof Error ? cause.message : String(cause)}.`,
        },
      });
    }

    if (Option.isNone(sdkProbe.success)) {
      return buildServerProvider({
        provider: PROVIDER,
        enabled: copilotSettings.enabled,
        checkedAt,
        models: baseModels,
        probe: {
          installed: true,
          version: null,
          status: "error",
          auth: { status: "unknown" },
          message: "GitHub Copilot health check timed out.",
        },
      });
    }

    const { authStatus, listedModels, status } = sdkProbe.success.value;
    const auth = resolveCopilotServerAuth(authStatus);

    const authStatusState: Exclude<ServerProvider["status"], "disabled"> =
      auth.status === "unauthenticated" ? "error" : auth.status === "unknown" ? "warning" : "ready";

    const resolvedModels =
      listedModels && listedModels.length > 0
        ? providerModelsFromSettings(
            listedModels.map(mapModelInfoToServerModel),
            PROVIDER,
            copilotSettings.customModels,
          )
        : baseModels;

    const version =
      status?.version != null && String(status.version).trim().length > 0
        ? String(status.version).trim()
        : null;

    return buildServerProvider({
      provider: PROVIDER,
      enabled: copilotSettings.enabled,
      checkedAt,
      models: resolvedModels,
      probe: {
        installed: true,
        version,
        status: authStatusState,
        auth,
        ...(authStatus?.statusMessage
          ? { message: authStatus.statusMessage }
          : version
            ? { message: `GitHub Copilot ${version}` }
            : {}),
      },
    });
  },
);

export const CopilotProviderLive = Layer.effect(
  CopilotProvider,
  Effect.gen(function* () {
    const serverSettings = yield* ServerSettingsService;

    const checkProvider = checkCopilotProviderStatus().pipe(
      Effect.provideService(ServerSettingsService, serverSettings),
    );

    return yield* makeManagedServerProvider<CopilotSettings>({
      getSettings: serverSettings.getSettings.pipe(
        Effect.map((settings) => settings.providers.copilot),
        Effect.orDie,
      ),
      streamSettings: serverSettings.streamChanges.pipe(
        Stream.map((settings) => settings.providers.copilot),
      ),
      haveSettingsChanged: (previous, next) => !Equal.equals(previous, next),
      checkProvider,
    });
  }),
);
