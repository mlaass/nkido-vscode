import * as vscode from "vscode";

/**
 * Shape of a diagnostic emitted by `nkido-cli check --json` and by the
 * `serve` mode `diagnostic` event. Mirrors `akkado::format_diagnostic_json`
 * (akkado/src/diagnostics.cpp).
 */
export interface NkidoDiagnostic {
  severity: "error" | "warning" | "info" | "hint";
  code: string;
  message: string;
  file: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

const SEVERITY_MAP: Record<string, vscode.DiagnosticSeverity> = {
  error: vscode.DiagnosticSeverity.Error,
  warning: vscode.DiagnosticSeverity.Warning,
  info: vscode.DiagnosticSeverity.Information,
  hint: vscode.DiagnosticSeverity.Hint,
};

/**
 * Convert a parsed diagnostic from nkido-cli into a vscode.Diagnostic.
 * Lines/characters are already 0-indexed in the JSON shape.
 */
export function toVscodeDiagnostic(d: NkidoDiagnostic): vscode.Diagnostic {
  const range = new vscode.Range(
    d.range.start.line,
    d.range.start.character,
    d.range.end.line,
    d.range.end.character,
  );
  const diag = new vscode.Diagnostic(
    range,
    d.message,
    SEVERITY_MAP[d.severity] ?? vscode.DiagnosticSeverity.Error,
  );
  diag.code = d.code;
  diag.source = "nkido";
  return diag;
}

/**
 * Parse one or more newline-delimited JSON diagnostic lines from a single
 * blob (as `nkido-cli check --json` emits to stderr) into vscode.Diagnostics.
 * Lines that don't parse as a diagnostic shape are silently skipped.
 */
export function parseDiagnosticsBlob(blob: string): vscode.Diagnostic[] {
  const out: vscode.Diagnostic[] = [];
  for (const line of blob.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed);
      if (obj && typeof obj === "object" && "severity" in obj && "range" in obj) {
        out.push(toVscodeDiagnostic(obj as NkidoDiagnostic));
      }
    } catch {
      // Not JSON or not a diagnostic — ignore.
    }
  }
  return out;
}
