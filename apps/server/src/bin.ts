// @effect-diagnostics effect/anyUnknownInErrorContext:off
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Command } from "effect/unstable/cli";

import { NetService } from "@t3tools/shared/Net";
import { cli } from "./cli";
import { version } from "../package.json" with { type: "json" };

const CliRuntimeLayer = Layer.mergeAll(NodeServices.layer, NetService.layer);

const cliMain = Command.run(cli, { version }).pipe(Effect.scoped, Effect.provide(CliRuntimeLayer));

/** Context channel stays `any` from unstable/cli; NodeRuntime expects `never`. */
NodeRuntime.runMain(cliMain as Parameters<typeof NodeRuntime.runMain>[0]);
