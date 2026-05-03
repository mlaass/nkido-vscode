import * as vscode from "vscode";

let channel: vscode.OutputChannel | null = null;

export function getOutputChannel(): vscode.OutputChannel {
  if (!channel) {
    channel = vscode.window.createOutputChannel("Nkido");
  }
  return channel;
}

export function log(message: string): void {
  const ts = new Date().toISOString().slice(11, 23);
  getOutputChannel().appendLine(`[${ts}] ${message}`);
}
