import { spawn } from "node:child_process";
import { resolveBundledMeridianBrainPath } from "../../knowledge/bundledMeridianBrainPath";

export interface CliSpawnResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly json: unknown | null;
  readonly duration: number;
}

export interface CliSpawnOptions {
  /** Timeout in milliseconds. Defaults to 60_000 (60s). */
  readonly timeout?: number;
  /** Additional environment variables. */
  readonly env?: Record<string, string>;
}

const DEFAULT_TIMEOUT = 60_000;

/**
 * Spawn a Meridian CLI tool as a child process and capture its JSON output.
 *
 * Invocation: `node {brainPath}/core/scripts/workflow/dist/cli/{tool}.js {command} {...args} --json`
 */
export async function spawnCli(
  tool: string,
  args: readonly string[],
  options?: CliSpawnOptions,
): Promise<CliSpawnResult> {
  const brainPath = resolveBundledMeridianBrainPath();
  const scriptPath = `${brainPath}/core/scripts/workflow/dist/cli/${tool}.js`;
  const fullArgs = ["--experimental-strip-types", scriptPath, ...args, "--json"];
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT;

  const start = Date.now();

  return new Promise<CliSpawnResult>((resolve) => {
    const child = spawn(process.execPath, fullArgs, {
      cwd: brainPath,
      stdio: ["ignore", "pipe", "pipe"],
      timeout,
      env: {
        ...process.env,
        ...options?.env,
      },
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    child.on("close", (code) => {
      const stdout = Buffer.concat(stdoutChunks).toString("utf-8");
      const stderr = Buffer.concat(stderrChunks).toString("utf-8");
      const duration = Date.now() - start;

      let json: unknown | null = null;
      try {
        json = JSON.parse(stdout);
      } catch {
        // stdout is not valid JSON — leave as null
      }

      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
        json,
        duration,
      });
    });

    child.on("error", (err) => {
      resolve({
        exitCode: 1,
        stdout: "",
        stderr: err.message,
        json: null,
        duration: Date.now() - start,
      });
    });
  });
}

/**
 * Convenience wrapper that returns the JSON result or a formatted error string.
 * Intended for use inside defineTool handlers.
 */
export async function runCliTool(
  tool: string,
  args: readonly string[],
  options?: CliSpawnOptions,
): Promise<string> {
  const result = await spawnCli(tool, args, options);

  if (result.exitCode === 0 && result.json != null) {
    return JSON.stringify(result.json, null, 2);
  }

  if (result.exitCode === 0) {
    return result.stdout || "(no output)";
  }

  const errorParts = [`CLI tool '${tool}' failed (exit code ${result.exitCode})`];
  if (result.stderr) errorParts.push(`stderr: ${result.stderr.slice(0, 2000)}`);
  if (result.stdout) errorParts.push(`stdout: ${result.stdout.slice(0, 2000)}`);
  return errorParts.join("\n");
}
