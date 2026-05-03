import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import * as vscode from "vscode";
import { log } from "../utils/logger";
import { toVscodeDiagnostic, NkidoDiagnostic } from "../providers/diagnostic-provider";

export type ServeEvent =
  | { event: "ready" }
  | { event: "compiled"; ok: boolean }
  | (NkidoDiagnostic & { event: "diagnostic" })
  | { event: "stopped" }
  | { event: "param_changed"; name: string; value: number; ok: boolean }
  | { event: "error"; message: string };

export interface ServeOptions {
  getCliPath: () => string;
  getSampleRate: () => number;
  getBufferSize: () => number;
}

type EventHandler = (event: ServeEvent) => void;

/**
 * Manages a persistent `nkido-cli serve` process. Sends newline-delimited
 * JSON commands on stdin and dispatches incoming events to listeners.
 *
 * One instance per workspace. Lazily started on first command. Crashes
 * trigger a one-shot warning and clear the process so the next send retries.
 */
export class ServeModeManager {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private buffer = "";
  private listeners = new Set<EventHandler>();
  private diagnosticCollection: vscode.DiagnosticCollection;

  constructor(
    private readonly opts: ServeOptions,
    diagnosticCollection: vscode.DiagnosticCollection,
  ) {
    this.diagnosticCollection = diagnosticCollection;
  }

  onEvent(handler: EventHandler): vscode.Disposable {
    this.listeners.add(handler);
    return new vscode.Disposable(() => this.listeners.delete(handler));
  }

  isRunning(): boolean {
    return this.proc !== null;
  }

  private start(): boolean {
    if (this.proc) return true;
    const cliPath = this.opts.getCliPath();
    const sampleRate = this.opts.getSampleRate();
    const bufferSize = this.opts.getBufferSize();
    log(`Starting: ${cliPath} serve --rate ${sampleRate} --buffer ${bufferSize}`);
    try {
      this.proc = spawn(cliPath, [
        "serve",
        "--rate",
        String(sampleRate),
        "--buffer",
        String(bufferSize),
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Failed to launch nkido-cli: ${msg}`);
      log(`spawn failed: ${msg}`);
      return false;
    }

    this.proc.stdout.on("data", (b: Buffer) => this.handleStdout(b.toString()));
    this.proc.stderr.on("data", (b: Buffer) => log(`[serve stderr] ${b.toString().trimEnd()}`));
    this.proc.on("error", (err) => {
      log(`serve process error: ${err.message}`);
      const hint = err.message.includes("ENOENT")
        ? `nkido-cli not found at "${cliPath}". Set "nkido.cliPath" in Settings to the absolute path of the binary.`
        : `nkido-cli serve error: ${err.message}`;
      vscode.window.showErrorMessage(hint);
      this.proc = null;
    });
    this.proc.on("exit", (code, signal) => {
      log(`serve process exited (code=${code}, signal=${signal ?? "none"})`);
      this.proc = null;
    });
    return true;
  }

  private handleStdout(chunk: string): void {
    this.buffer += chunk;
    let nl;
    while ((nl = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, nl).trim();
      this.buffer = this.buffer.slice(nl + 1);
      if (!line) continue;
      try {
        const event = JSON.parse(line) as ServeEvent;
        this.dispatch(event);
      } catch (err) {
        log(`bad event line: ${line}`);
      }
    }
  }

  private dispatch(event: ServeEvent): void {
    for (const h of this.listeners) {
      try {
        h(event);
      } catch (err) {
        log(`listener error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  /**
   * Send a `load` command. Compile diagnostics will be applied to the given
   * `documentUri` automatically.
   */
  load(source: string, documentUri: vscode.Uri): boolean {
    if (!this.start()) return false;
    const collected: vscode.Diagnostic[] = [];
    const disposable = this.onEvent((event) => {
      if (event.event === "diagnostic") {
        collected.push(toVscodeDiagnostic(event));
      } else if (event.event === "compiled") {
        this.diagnosticCollection.set(documentUri, collected);
        disposable.dispose();
      }
    });
    return this.send({
      cmd: "load",
      source,
      uri: documentUri.toString(),
    });
  }

  stop(): boolean {
    if (!this.proc) return true;
    return this.send({ cmd: "stop" });
  }

  setParam(name: string, value: number): boolean {
    if (!this.start()) return false;
    return this.send({ cmd: "set_param", name, value });
  }

  /** Kill the process. Called on extension deactivation. */
  shutdown(): void {
    if (!this.proc) return;
    try {
      this.send({ cmd: "quit" });
      this.proc.kill();
    } catch {
      // proc already gone
    }
    this.proc = null;
  }

  private send(cmd: object): boolean {
    if (!this.proc) return false;
    try {
      this.proc.stdin.write(JSON.stringify(cmd) + "\n");
      return true;
    } catch (err) {
      log(`stdin write failed: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }
}
