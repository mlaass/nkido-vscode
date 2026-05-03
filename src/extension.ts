import * as vscode from "vscode";
import { CliClient } from "./cli/cli-client";
import { ServeModeManager } from "./cli/serve-mode-manager";
import { CompletionProvider } from "./providers/completion-provider";
import { SignatureHelpProvider } from "./providers/signature-help";
import { readConfig } from "./utils/config";
import { getOutputChannel, log } from "./utils/logger";

const LANGUAGE_ID = "akkado";

let serveManager: ServeModeManager | null = null;

export function activate(context: vscode.ExtensionContext) {
  const channel = getOutputChannel();
  context.subscriptions.push(channel);
  log("Nkido extension activated");

  const diagnosticCollection = vscode.languages.createDiagnosticCollection(LANGUAGE_ID);
  context.subscriptions.push(diagnosticCollection);

  const cliClient = new CliClient(() => readConfig().cliPath);
  serveManager = new ServeModeManager(
    {
      getCliPath: () => readConfig().cliPath,
      getSampleRate: () => readConfig().sampleRate,
      getBufferSize: () => readConfig().bufferSize,
    },
    diagnosticCollection,
  );

  // Restart serve when settings that affect the spawned process change so the
  // user doesn't need to reload the window after pointing at a new binary.
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration("nkido.cliPath") ||
        e.affectsConfiguration("nkido.audio.sampleRate") ||
        e.affectsConfiguration("nkido.audio.bufferSize")
      ) {
        log("nkido config changed; shutting down serve so next command respawns with new settings");
        serveManager?.shutdown();
      }
    }),
  );

  // Surface notable serve events in the output channel.
  context.subscriptions.push(
    serveManager.onEvent((event) => {
      switch (event.event) {
        case "ready":
          log("serve ready");
          break;
        case "compiled":
          log(event.ok ? "compiled ok" : "compile failed");
          break;
        case "stopped":
          log("playback stopped");
          break;
        case "error":
          log(`serve error: ${event.message}`);
          vscode.window.showErrorMessage(`Nkido: ${event.message}`);
          break;
      }
    }),
  );

  // Providers
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      LANGUAGE_ID,
      new CompletionProvider(),
      ...CompletionProvider.triggerCharacters,
    ),
    vscode.languages.registerSignatureHelpProvider(
      LANGUAGE_ID,
      new SignatureHelpProvider(),
      ...SignatureHelpProvider.triggerCharacters,
    ),
  );

  // Optional: refresh diagnostics on save. Read config on each save so toggling
  // the setting takes effect without a window reload.
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (doc) => {
      if (doc.languageId !== LANGUAGE_ID) return;
      const cfg = readConfig();
      if (!cfg.autoCompileOnSave) return;
      const result = await cliClient.check(doc.uri.fsPath);
      if (cfg.diagnosticsEnabled) {
        diagnosticCollection.set(doc.uri, result.diagnostics);
      }
    }),
  );

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand("nkido.evaluate", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== LANGUAGE_ID) {
        vscode.window.showInformationMessage("Open an Akkado file first.");
        return;
      }
      const doc = editor.document;
      if (doc.isDirty) {
        await doc.save();
      }
      const source = doc.getText();
      if (!source.trim()) {
        vscode.window.showInformationMessage("Nothing to evaluate.");
        return;
      }
      const ok = serveManager!.load(source, doc.uri);
      if (ok) {
        log(`evaluate: ${doc.uri.fsPath}`);
      } else {
        vscode.window.showErrorMessage(
          "Could not send program to nkido-cli serve. Check the Nkido output for details.",
        );
      }
    }),

    vscode.commands.registerCommand("nkido.stop", () => {
      if (serveManager?.isRunning()) {
        serveManager.stop();
      }
    }),

    vscode.commands.registerCommand("nkido.compile", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== LANGUAGE_ID) return;
      const src = editor.document.uri.fsPath;
      const out = src.replace(/\.(akkado|akk)$/, ".cedar");
      const result = await cliClient.compile(src, out);
      if (result.ok) {
        vscode.window.showInformationMessage(`Compiled to ${out}`);
      } else {
        vscode.window.showErrorMessage(`Compile failed: ${result.stderr.split(/\r?\n/)[0]}`);
        log(result.stderr);
      }
    }),

    vscode.commands.registerCommand("nkido.check", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== LANGUAGE_ID) return;
      const result = await cliClient.check(editor.document.uri.fsPath);
      if (readConfig().diagnosticsEnabled) {
        diagnosticCollection.set(editor.document.uri, result.diagnostics);
      }
      if (result.ok) {
        vscode.window.showInformationMessage("Akkado: no errors");
      } else {
        vscode.window.showWarningMessage(
          `Akkado: ${result.diagnostics.length} diagnostic(s); see Problems panel.`,
        );
      }
    }),

    vscode.commands.registerCommand("nkido.showOutput", () => {
      channel.show(true);
    }),

    vscode.commands.registerCommand("nkido.restartCli", () => {
      serveManager?.shutdown();
      log("serve process restarted");
    }),
  );
}

export function deactivate() {
  serveManager?.shutdown();
  serveManager = null;
}
