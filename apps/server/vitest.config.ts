import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, mergeConfig } from "vitest/config";

import baseConfig from "../../vitest.config";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const copilotSdkDir = (() => {
  const expectedPath = path.join(serverDir, "node_modules", "@github", "copilot-sdk");
  try {
    return fs.realpathSync(expectedPath);
  } catch {
    throw new Error(
      `vitest.config: could not locate @github/copilot-sdk at ${expectedPath}. ` +
        `Reinstall dependencies and verify the package manager created the expected node_modules entries.`,
    );
  }
})();
// Bun nests vscode-jsonrpc next to `@github/copilot-sdk` under the `.bun` package `node_modules/`.
const vscodeJsonRpcNodeEntry = path.join(copilotSdkDir, "..", "..", "vscode-jsonrpc", "node.js");
if (!fs.existsSync(vscodeJsonRpcNodeEntry)) {
  throw new Error(
    `vitest.config: could not locate vscode-jsonrpc at ${vscodeJsonRpcNodeEntry} (needed for @github/copilot-sdk under Node ESM).`,
  );
}

export default mergeConfig(
  baseConfig,
  defineConfig({
    resolve: {
      alias: {
        // vscode-jsonrpc publishes `node.js` but @github/copilot-sdk imports `vscode-jsonrpc/node`,
        // which Node ESM does not resolve without an "exports" map. Pin the file for Vitest.
        "vscode-jsonrpc/node": vscodeJsonRpcNodeEntry,
      },
    },
    ssr: {
      noExternal: ["@github/copilot-sdk"],
    },
    test: {
      // The server suite exercises sqlite, git, temp worktrees, and orchestration
      // runtimes heavily. Running files in parallel introduces load-sensitive flakes.
      fileParallelism: false,
      // Server integration tests exercise sqlite, git, and orchestration together.
      // Under package-wide parallel runs they regularly exceed the default 15s budget.
      testTimeout: 60_000,
      hookTimeout: 60_000,
    },
  }),
);
