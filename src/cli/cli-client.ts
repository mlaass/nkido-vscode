import { spawn } from "child_process";
import * as vscode from "vscode";
import { parseDiagnosticsBlob } from "../providers/diagnostic-provider";
import { log } from "../utils/logger";

export interface CheckResult {
  ok: boolean;
  diagnostics: vscode.Diagnostic[];
  stderr: string;
}

/**
 * Spawn-per-command wrapper for the simple `nkido-cli` subcommands. Used for
 * save-time linting (`check --json`) and the explicit `compile` command.
 * Live playback goes through ServeModeManager.
 */
export class CliClient {
  constructor(private readonly getCliPath: () => string) {}

  async check(filePath: string): Promise<CheckResult> {
    return new Promise((resolve) => {
      const proc = spawn(this.getCliPath(), ["check", filePath, "--json"]);
      let stderr = "";
      proc.stderr.on("data", (b: Buffer) => (stderr += b.toString()));
      proc.on("error", (err) => {
        log(`check spawn error: ${err.message}`);
        resolve({ ok: false, diagnostics: [], stderr: err.message });
      });
      proc.on("close", (code) => {
        const diagnostics = parseDiagnosticsBlob(stderr);
        resolve({ ok: code === 0, diagnostics, stderr });
      });
    });
  }

  async compile(filePath: string, outputPath: string): Promise<{ ok: boolean; stderr: string }> {
    return new Promise((resolve) => {
      const proc = spawn(this.getCliPath(), ["compile", "-o", outputPath, filePath]);
      let stderr = "";
      proc.stderr.on("data", (b: Buffer) => (stderr += b.toString()));
      proc.on("error", (err) => resolve({ ok: false, stderr: err.message }));
      proc.on("close", (code) => resolve({ ok: code === 0, stderr }));
    });
  }
}
