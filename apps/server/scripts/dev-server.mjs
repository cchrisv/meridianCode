#!/usr/bin/env node
/**
 * Dev entry: Bun cannot provide a PTY on Windows, so the server crashes when run via `bun`.
 * On win32, run the CLI under Node (NodePTY) using tsx so resolution matches Bun dev.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import process from "node:process";

const serverRoot = fileURLToPath(new URL("..", import.meta.url));
const binTs = fileURLToPath(new URL("../src/bin.ts", import.meta.url));
const isWin = process.platform === "win32";

if (isWin && process.env.T3CODE_PORT && process.env.PORT) {
  console.info(
    `[t3 dev] UI (Vite): http://127.0.0.1:${process.env.PORT}  ·  API/WebSocket: ${process.env.T3CODE_PORT}`,
  );
}

const require = createRequire(import.meta.url);
// Node on Windows requires a file:// URL for --import when using an absolute filesystem path.
const tsxImportHook = pathToFileURL(require.resolve("tsx/esm")).href;

const child = isWin
  ? spawn(process.execPath, ["--import", tsxImportHook, binTs], {
      cwd: serverRoot,
      stdio: "inherit",
      env: process.env,
      shell: false,
    })
  : spawn("bun", ["run", "src/bin.ts"], {
      cwd: serverRoot,
      stdio: "inherit",
      env: process.env,
      shell: false,
    });

child.on("error", (err) => {
  console.error(err);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
