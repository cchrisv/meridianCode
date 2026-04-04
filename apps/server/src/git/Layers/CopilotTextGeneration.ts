import { approveAll, CopilotClient } from "@github/copilot-sdk";
import type { CopilotModelSelection } from "@t3tools/contracts";
import { TextGenerationError } from "@t3tools/contracts";
import { Effect, FileSystem, Layer, Path, Schema } from "effect";

import { sanitizeBranchFragment, sanitizeFeatureBranchName } from "@t3tools/shared/git";
import { normalizeCopilotModelOptionsWithCapabilities } from "@t3tools/shared/model";

import { resolveAttachmentPath } from "../../attachmentStore.ts";
import { ServerConfig } from "../../config.ts";
import {
  normalizeCopilotCliPathOverride,
  resolveBundledCopilotCliPath,
} from "../../provider/Layers/copilotCliPath.ts";
import { getCopilotModelCapabilities } from "../../provider/Layers/CopilotProvider.ts";
import { ServerSettingsService } from "../../serverSettings.ts";
import {
  type BranchNameGenerationInput,
  type TextGenerationShape,
  TextGeneration,
  type ThreadTitleGenerationResult,
} from "../Services/TextGeneration.ts";
import {
  buildBranchNamePrompt,
  buildCommitMessagePrompt,
  buildPrContentPrompt,
  buildThreadTitlePrompt,
} from "../Prompts.ts";
import {
  sanitizeCommitSubject,
  sanitizePrTitle,
  sanitizeThreadTitle,
  toJsonSchemaObject,
} from "../Utils.ts";

const COPILOT_TIMEOUT_MS = 180_000;

function extractJsonPayload(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/m);
  const body = fence?.[1]?.trim() ?? trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(body.slice(start, end + 1)) as unknown;
  }
  return JSON.parse(body) as unknown;
}

const makeCopilotTextGeneration = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const serverConfig = yield* Effect.service(ServerConfig);
  const serverSettingsService = yield* Effect.service(ServerSettingsService);

  type MaterializedImageAttachments = {
    readonly imagePaths: ReadonlyArray<string>;
  };

  const materializeImageAttachments = Effect.fn("copilotMaterializeImageAttachments")(function* (
    _operation: "generateBranchName" | "generateThreadTitle",
    attachments: BranchNameGenerationInput["attachments"],
  ): Effect.fn.Return<MaterializedImageAttachments, TextGenerationError> {
    if (!attachments || attachments.length === 0) {
      return { imagePaths: [] };
    }

    const imagePaths: string[] = [];
    for (const attachment of attachments) {
      if (attachment.type !== "image") continue;
      const resolvedPath = resolveAttachmentPath({
        attachmentsDir: serverConfig.attachmentsDir,
        attachment,
      });
      if (!resolvedPath || !path.isAbsolute(resolvedPath)) continue;
      const fileInfo = yield* fileSystem
        .stat(resolvedPath)
        .pipe(Effect.catch(() => Effect.succeed(null)));
      if (!fileInfo || fileInfo.type !== "File") continue;
      imagePaths.push(resolvedPath);
    }
    return { imagePaths };
  });

  const runCopilotJson = Effect.fn("runCopilotJson")(function* <S extends Schema.Top>({
    operation,
    cwd,
    prompt,
    outputSchemaJson,
    imagePaths = [],
    modelSelection,
  }: {
    operation:
      | "generateCommitMessage"
      | "generatePrContent"
      | "generateBranchName"
      | "generateThreadTitle";
    cwd: string;
    prompt: string;
    outputSchemaJson: S;
    imagePaths?: ReadonlyArray<string>;
    modelSelection: CopilotModelSelection;
  }): Effect.fn.Return<S["Type"], TextGenerationError, S["DecodingServices"]> {
    const copilotSettings = yield* serverSettingsService.getSettings.pipe(
      Effect.map((s) => s.providers.copilot),
      Effect.mapError(
        (error) =>
          new TextGenerationError({
            operation,
            detail: error.message,
            cause: error,
          }),
      ),
    );

    const cliPath =
      normalizeCopilotCliPathOverride(copilotSettings.binaryPath) ?? resolveBundledCopilotCliPath();
    const configTrim = copilotSettings.configDir.trim();

    const caps = getCopilotModelCapabilities(modelSelection.model);
    const normalizedOptions = normalizeCopilotModelOptionsWithCapabilities(
      caps,
      modelSelection.options,
    );
    const reasoningEffort = normalizedOptions?.reasoningEffort;

    const schemaHint = JSON.stringify(toJsonSchemaObject(outputSchemaJson));
    const fullPrompt = `${prompt}\n\nRespond with ONLY valid JSON (no markdown) matching:\n${schemaHint}`;

    const raw = yield* Effect.tryPromise({
      try: async (): Promise<unknown> => {
        const client = new CopilotClient({
          ...(cliPath ? { cliPath } : {}),
          logLevel: "error",
          cwd,
          ...(configTrim.length > 0
            ? { env: { ...process.env, GITHUB_COPILOT_CONFIG_DIR: configTrim } }
            : {}),
        });
        await client.start();
        try {
          const session = await client.createSession({
            workingDirectory: cwd,
            model: modelSelection.model,
            ...(reasoningEffort ? { reasoningEffort } : {}),
            streaming: true,
            onPermissionRequest: approveAll,
          });
          try {
            const attachments =
              imagePaths.length > 0
                ? imagePaths.map((p) => ({ type: "file" as const, path: p }))
                : undefined;
            const assistant = await session.sendAndWait(
              { prompt: fullPrompt, ...(attachments ? { attachments } : {}) },
              COPILOT_TIMEOUT_MS,
            );
            const content = assistant?.data.content?.trim() ?? "";
            if (!content) {
              throw new Error("Empty response from GitHub Copilot.");
            }
            return extractJsonPayload(content);
          } finally {
            await session.disconnect().catch(() => undefined);
          }
        } finally {
          await client.stop().catch(() => []);
        }
      },
      catch: (cause) =>
        new TextGenerationError({
          operation,
          detail: cause instanceof Error ? cause.message : "GitHub Copilot request failed.",
          cause,
        }),
    });

    return yield* Schema.decodeUnknownEffect(outputSchemaJson)(raw).pipe(
      Effect.mapError(
        (cause) =>
          new TextGenerationError({
            operation,
            detail: "GitHub Copilot returned invalid structured output.",
            cause,
          }),
      ),
    );
  });

  const generateCommitMessage: TextGenerationShape["generateCommitMessage"] = Effect.fn(
    "CopilotTextGeneration.generateCommitMessage",
  )(function* (input) {
    const { prompt, outputSchema } = buildCommitMessagePrompt({
      branch: input.branch,
      stagedSummary: input.stagedSummary,
      stagedPatch: input.stagedPatch,
      includeBranch: input.includeBranch === true,
    });

    if (input.modelSelection.provider !== "copilot") {
      return yield* new TextGenerationError({
        operation: "generateCommitMessage",
        detail: "Invalid model selection.",
      });
    }

    const generated = yield* runCopilotJson({
      operation: "generateCommitMessage",
      cwd: input.cwd,
      prompt,
      outputSchemaJson: outputSchema,
      modelSelection: input.modelSelection,
    });

    return {
      subject: sanitizeCommitSubject(generated.subject),
      body: generated.body.trim(),
      ...("branch" in generated && typeof generated.branch === "string"
        ? { branch: sanitizeFeatureBranchName(generated.branch) }
        : {}),
    };
  });

  const generatePrContent: TextGenerationShape["generatePrContent"] = Effect.fn(
    "CopilotTextGeneration.generatePrContent",
  )(function* (input) {
    const { prompt, outputSchema } = buildPrContentPrompt({
      baseBranch: input.baseBranch,
      headBranch: input.headBranch,
      commitSummary: input.commitSummary,
      diffSummary: input.diffSummary,
      diffPatch: input.diffPatch,
    });

    if (input.modelSelection.provider !== "copilot") {
      return yield* new TextGenerationError({
        operation: "generatePrContent",
        detail: "Invalid model selection.",
      });
    }

    const generated = yield* runCopilotJson({
      operation: "generatePrContent",
      cwd: input.cwd,
      prompt,
      outputSchemaJson: outputSchema,
      modelSelection: input.modelSelection,
    });

    return {
      title: sanitizePrTitle(generated.title),
      body: generated.body.trim(),
    };
  });

  const generateBranchName: TextGenerationShape["generateBranchName"] = Effect.fn(
    "CopilotTextGeneration.generateBranchName",
  )(function* (input) {
    const { imagePaths } = yield* materializeImageAttachments(
      "generateBranchName",
      input.attachments,
    );
    const { prompt, outputSchema } = buildBranchNamePrompt({
      message: input.message,
      attachments: input.attachments,
    });

    if (input.modelSelection.provider !== "copilot") {
      return yield* new TextGenerationError({
        operation: "generateBranchName",
        detail: "Invalid model selection.",
      });
    }

    const generated = yield* runCopilotJson({
      operation: "generateBranchName",
      cwd: input.cwd,
      prompt,
      outputSchemaJson: outputSchema,
      imagePaths,
      modelSelection: input.modelSelection,
    });

    return {
      branch: sanitizeBranchFragment(generated.branch),
    };
  });

  const generateThreadTitle: TextGenerationShape["generateThreadTitle"] = Effect.fn(
    "CopilotTextGeneration.generateThreadTitle",
  )(function* (input) {
    const { imagePaths } = yield* materializeImageAttachments(
      "generateThreadTitle",
      input.attachments,
    );
    const { prompt, outputSchema } = buildThreadTitlePrompt({
      message: input.message,
      attachments: input.attachments,
    });

    if (input.modelSelection.provider !== "copilot") {
      return yield* new TextGenerationError({
        operation: "generateThreadTitle",
        detail: "Invalid model selection.",
      });
    }

    const generated = yield* runCopilotJson({
      operation: "generateThreadTitle",
      cwd: input.cwd,
      prompt,
      outputSchemaJson: outputSchema,
      imagePaths,
      modelSelection: input.modelSelection,
    });

    return {
      title: sanitizeThreadTitle(generated.title),
    } satisfies ThreadTitleGenerationResult;
  });

  return {
    generateCommitMessage,
    generatePrContent,
    generateBranchName,
    generateThreadTitle,
  } satisfies TextGenerationShape;
});

export const CopilotTextGenerationLive = Layer.effect(TextGeneration, makeCopilotTextGeneration);
