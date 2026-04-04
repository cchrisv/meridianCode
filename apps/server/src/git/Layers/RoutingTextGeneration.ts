/**
 * RoutingTextGeneration – Dispatches text generation requests to the
 * GitHub Copilot text generation layer.
 *
 * @module RoutingTextGeneration
 */
import { Effect, Layer, ServiceMap } from "effect";

import {
  TextGeneration,
  type TextGenerationShape,
} from "../Services/TextGeneration.ts";
import { CopilotTextGenerationLive } from "./CopilotTextGeneration.ts";

// ---------------------------------------------------------------------------
// Internal service tag so the concrete layer can coexist.
// ---------------------------------------------------------------------------

class CopilotTextGen extends ServiceMap.Service<CopilotTextGen, TextGenerationShape>()(
  "t3/git/Layers/RoutingTextGeneration/CopilotTextGen",
) {}

// ---------------------------------------------------------------------------
// Routing implementation
// ---------------------------------------------------------------------------

const makeRoutingTextGeneration = Effect.gen(function* () {
  const copilot = yield* CopilotTextGen;

  return {
    generateCommitMessage: (input) => copilot.generateCommitMessage(input),
    generatePrContent: (input) => copilot.generatePrContent(input),
    generateBranchName: (input) => copilot.generateBranchName(input),
    generateThreadTitle: (input) => copilot.generateThreadTitle(input),
  } satisfies TextGenerationShape;
});

const InternalCopilotLayer = Layer.effect(
  CopilotTextGen,
  Effect.gen(function* () {
    const svc = yield* TextGeneration;
    return svc;
  }),
).pipe(Layer.provide(CopilotTextGenerationLive));

export const RoutingTextGenerationLive = Layer.effect(
  TextGeneration,
  makeRoutingTextGeneration,
).pipe(
  Layer.provide(InternalCopilotLayer),
);
