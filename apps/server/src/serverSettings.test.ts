import * as NodeServices from "@effect/platform-node/NodeServices";
import { DEFAULT_SERVER_SETTINGS, ServerSettingsPatch } from "@t3tools/contracts";
import { assert, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Schema } from "effect";
import { ServerConfig } from "./config";
import { ServerSettingsLive, ServerSettingsService } from "./serverSettings";

const makeServerSettingsLayer = () =>
  ServerSettingsLive.pipe(
    Layer.provideMerge(
      Layer.fresh(
        ServerConfig.layerTest(process.cwd(), {
          prefix: "t3code-server-settings-test-",
        }),
      ),
    ),
  );

it.layer(NodeServices.layer)("server settings", (it) => {
  it.effect("decodes nested settings patches", () =>
    Effect.sync(() => {
      const decodePatch = Schema.decodeUnknownSync(ServerSettingsPatch);

      assert.deepEqual(decodePatch({ providers: { copilot: { binaryPath: "/tmp/copilot" } } }), {
        providers: { copilot: { binaryPath: "/tmp/copilot" } },
      });

      assert.deepEqual(
        decodePatch({
          textGenerationModelSelection: {
            options: {
              reasoningEffort: "high",
            },
          },
        }),
        {
          textGenerationModelSelection: {
            options: {
              reasoningEffort: "high",
            },
          },
        },
      );
    }),
  );

  it.effect("deep merges nested settings updates without dropping siblings", () =>
    Effect.gen(function* () {
      const serverSettings = yield* ServerSettingsService;

      yield* serverSettings.updateSettings({
        providers: {
          copilot: {
            enabled: true,
            binaryPath: "/usr/local/bin/copilot",
            configDir: "/Users/julius/.copilot",
          },
        },
        textGenerationModelSelection: {
          provider: "copilot",
          model: DEFAULT_SERVER_SETTINGS.textGenerationModelSelection.model,
          options: {
            reasoningEffort: "high",
          },
        },
      });

      const next = yield* serverSettings.updateSettings({
        providers: {
          copilot: {
            binaryPath: "/opt/homebrew/bin/copilot",
          },
        },
      });

      assert.deepEqual(next.providers.copilot, {
        enabled: true,
        binaryPath: "/opt/homebrew/bin/copilot",
        configDir: "/Users/julius/.copilot",
        customModels: [],
        skillDirectories: [],
        disabledSkills: [],
      });
      assert.deepEqual(next.textGenerationModelSelection, {
        provider: "copilot",
        model: DEFAULT_SERVER_SETTINGS.textGenerationModelSelection.model,
        options: {
          reasoningEffort: "high",
        },
      });
    }).pipe(Effect.provide(makeServerSettingsLayer())),
  );

  it.effect("preserves model when updating textGenerationModelSelection options", () =>
    Effect.gen(function* () {
      const serverSettings = yield* ServerSettingsService;

      yield* serverSettings.updateSettings({
        providers: {
          copilot: { enabled: true },
        },
        textGenerationModelSelection: {
          provider: "copilot",
          model: "claude-sonnet-4-6",
          options: {
            reasoningEffort: "high",
          },
        },
      });

      // Switching model — stale options must not cause the update to lose the selected model.
      const next = yield* serverSettings.updateSettings({
        textGenerationModelSelection: {
          provider: "copilot",
          model: "gpt-5.4",
          options: {
            reasoningEffort: "medium",
          },
        },
      });

      assert.deepEqual(next.textGenerationModelSelection, {
        provider: "copilot",
        model: "gpt-5.4",
        options: {
          reasoningEffort: "medium",
        },
      });
    }).pipe(Effect.provide(makeServerSettingsLayer())),
  );

  it.effect("trims provider path settings when updates are applied", () =>
    Effect.gen(function* () {
      const serverSettings = yield* ServerSettingsService;

      const next = yield* serverSettings.updateSettings({
        providers: {
          copilot: {
            enabled: true,
            binaryPath: "  /opt/homebrew/bin/copilot  ",
            configDir: "   ",
          },
        },
      });

      assert.deepEqual(next.providers.copilot, {
        enabled: true,
        binaryPath: "/opt/homebrew/bin/copilot",
        configDir: "",
        customModels: [],
        skillDirectories: [],
        disabledSkills: [],
      });
    }).pipe(Effect.provide(makeServerSettingsLayer())),
  );

  it.effect("trims observability settings when updates are applied", () =>
    Effect.gen(function* () {
      const serverSettings = yield* ServerSettingsService;

      const next = yield* serverSettings.updateSettings({
        observability: {
          otlpTracesUrl: "  http://localhost:4318/v1/traces  ",
          otlpMetricsUrl: "  http://localhost:4318/v1/metrics  ",
        },
      });

      assert.deepEqual(next.observability, {
        otlpTracesUrl: "http://localhost:4318/v1/traces",
        otlpMetricsUrl: "http://localhost:4318/v1/metrics",
      });
    }).pipe(Effect.provide(makeServerSettingsLayer())),
  );

  it.effect("defaults blank binary paths to provider executables", () =>
    Effect.gen(function* () {
      const serverSettings = yield* ServerSettingsService;

      const next = yield* serverSettings.updateSettings({
        providers: {
          copilot: {
            binaryPath: "   ",
          },
        },
      });

      assert.equal(next.providers.copilot.binaryPath, "copilot");
    }).pipe(Effect.provide(makeServerSettingsLayer())),
  );

  it.effect("writes only non-default server settings to disk", () =>
    Effect.gen(function* () {
      const serverSettings = yield* ServerSettingsService;
      const serverConfig = yield* ServerConfig;
      const fileSystem = yield* FileSystem.FileSystem;
      const next = yield* serverSettings.updateSettings({
        observability: {
          otlpTracesUrl: "http://localhost:4318/v1/traces",
          otlpMetricsUrl: "http://localhost:4318/v1/metrics",
        },
        providers: {
          copilot: {
            binaryPath: "/opt/homebrew/bin/copilot",
          },
        },
      });

      assert.equal(next.providers.copilot.binaryPath, "/opt/homebrew/bin/copilot");

      const raw = yield* fileSystem.readFileString(serverConfig.settingsPath);
      assert.deepEqual(JSON.parse(raw), {
        observability: {
          otlpTracesUrl: "http://localhost:4318/v1/traces",
          otlpMetricsUrl: "http://localhost:4318/v1/metrics",
        },
        providers: {
          copilot: {
            binaryPath: "/opt/homebrew/bin/copilot",
          },
        },
      });
    }).pipe(Effect.provide(makeServerSettingsLayer())),
  );
});
