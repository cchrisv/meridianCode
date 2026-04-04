import { WsRpcGroup } from "@t3tools/contracts";
import { Effect, Layer, ManagedRuntime } from "effect";
import { AtomRpc } from "effect/unstable/reactivity";

import { createWsRpcProtocolLayer } from "./protocol";

function castProtocolLayer(layer: Layer.Layer<any, any, any>): Layer.Layer<unknown, never, never> {
  return layer as unknown as Layer.Layer<unknown, never, never>;
}

export class WsRpcAtomClient extends AtomRpc.Service<WsRpcAtomClient>()("WsRpcAtomClient", {
  group: WsRpcGroup,
  // Effect RPC protocol layers carry generic service dependencies that are
  // satisfied at the WsTransport level, not at the static type level. The
  // suspend + cast bridges the gap so ManagedRuntime can provide the layer
  // without propagating those internal service constraints.
  protocol: castProtocolLayer(Layer.suspend(() => createWsRpcProtocolLayer())),
}) {}

let sharedRuntime: ManagedRuntime.ManagedRuntime<WsRpcAtomClient, never> | null = null;

function getRuntime() {
  if (sharedRuntime !== null) {
    return sharedRuntime;
  }

  sharedRuntime = ManagedRuntime.make(WsRpcAtomClient.layer);
  return sharedRuntime;
}

export function runRpc<TSuccess, TError = never>(
  execute: (client: typeof WsRpcAtomClient.Service) => Effect.Effect<TSuccess, TError, never>,
): Promise<TSuccess> {
  return getRuntime().runPromise(WsRpcAtomClient.use(execute));
}

export async function __resetWsRpcAtomClientForTests() {
  const runtime = sharedRuntime;
  sharedRuntime = null;
  await runtime?.dispose();
}
