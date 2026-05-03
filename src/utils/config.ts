import * as vscode from "vscode";

export interface NkidoConfig {
  cliPath: string;
  autoCompileOnSave: boolean;
  sampleRate: number;
  bufferSize: number;
  diagnosticsEnabled: boolean;
}

export function readConfig(): NkidoConfig {
  const c = vscode.workspace.getConfiguration("nkido");
  return {
    cliPath: c.get<string>("cliPath") || "nkido-cli",
    autoCompileOnSave: c.get<boolean>("autoCompileOnSave") ?? false,
    sampleRate: c.get<number>("audio.sampleRate") ?? 48000,
    bufferSize: c.get<number>("audio.bufferSize") ?? 128,
    diagnosticsEnabled: c.get<boolean>("diagnostics.enabled") ?? true,
  };
}
