/**
 * @github/copilot-sdk@0.1.32 imports `vscode-jsonrpc/node` without `.js`.
 * Node's native ESM resolver fails (ERR_MODULE_NOT_FOUND); Bun is lenient.
 * PATCH: normalize to `vscode-jsonrpc/node.js` (matches other files in the same package).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = path.resolve(serverRoot, "..", "..");

const before = `from "vscode-jsonrpc/node"`;
const after = `from "vscode-jsonrpc/node.js"`;

function patchSessionFile(sessionPath) {
  if (!fs.existsSync(sessionPath)) {
    return false;
  }
  let source = fs.readFileSync(sessionPath, "utf8");
  if (!source.includes(before) || source.includes(after)) {
    return false;
  }
  source = source.replaceAll(before, after);
  fs.writeFileSync(sessionPath, source, "utf8");
  console.info(`[patch-copilot-sdk] ${sessionPath}`);
  return true;
}

const candidates = [
  path.join(serverRoot, "node_modules", "@github", "copilot-sdk", "dist", "session.js"),
  path.join(repoRoot, "node_modules", "@github", "copilot-sdk", "dist", "session.js"),
];

const bunRoot = path.join(repoRoot, "node_modules", ".bun");
if (fs.existsSync(bunRoot)) {
  for (const ent of fs.readdirSync(bunRoot, { withFileTypes: true })) {
    if (!ent.isDirectory() || !ent.name.startsWith("@github+copilot-sdk@")) {
      continue;
    }
    candidates.push(
      path.join(bunRoot, ent.name, "node_modules", "@github", "copilot-sdk", "dist", "session.js"),
    );
  }
}

let patched = 0;
for (const p of candidates) {
  if (patchSessionFile(p)) {
    patched += 1;
  }
}

if (patched === 0) {
  console.info(
    "[patch-copilot-sdk] No session.js copies needed patching (already patched or missing).",
  );
}
