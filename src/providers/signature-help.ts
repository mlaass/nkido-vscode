import * as vscode from "vscode";
import { builtins, formatSignature } from "../data";

const IDENT_RE = /[A-Za-z_][A-Za-z0-9_]*/;

/**
 * Find the function name and active argument index for a `(`/`,` cursor.
 * Walks backwards from `position` to find the unmatched `(`, then identifies
 * the identifier preceding it. Counts top-level commas between that `(` and
 * the cursor to compute the active parameter index.
 */
function locateCall(
  document: vscode.TextDocument,
  position: vscode.Position,
): { name: string; activeIndex: number } | null {
  const offset = document.offsetAt(position);
  const text = document.getText();

  let depthParen = 0;
  let depthBrace = 0;
  let depthBracket = 0;
  let activeIndex = 0;
  let inString = false;
  let i = offset - 1;
  while (i >= 0) {
    const c = text[i];
    if (inString) {
      if (c === '"' && text[i - 1] !== "\\") inString = false;
      i--;
      continue;
    }
    if (c === '"') {
      inString = true;
      i--;
      continue;
    }
    if (c === ")") depthParen++;
    else if (c === "}") depthBrace++;
    else if (c === "]") depthBracket++;
    else if (c === "(") {
      if (depthParen === 0) {
        // Found the unmatched open paren.
        let j = i - 1;
        while (j >= 0 && /\s/.test(text[j])) j--;
        let end = j;
        while (j >= 0 && /[A-Za-z0-9_]/.test(text[j])) j--;
        const name = text.slice(j + 1, end + 1);
        if (name && IDENT_RE.test(name)) {
          return { name, activeIndex };
        }
        return null;
      }
      depthParen--;
    } else if (c === "{") depthBrace--;
    else if (c === "[") depthBracket--;
    else if (
      c === "," &&
      depthParen === 0 &&
      depthBrace === 0 &&
      depthBracket === 0
    ) {
      activeIndex++;
    }
    i--;
  }
  return null;
}

export class SignatureHelpProvider implements vscode.SignatureHelpProvider {
  static readonly triggerCharacters = ["(", ","];

  provideSignatureHelp(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.SignatureHelp | null {
    const call = locateCall(document, position);
    if (!call) return null;

    // Resolve aliases to canonical name for signature lookup.
    const canonical = builtins.aliases[call.name] ?? call.name;
    const fn = builtins.functions[canonical];
    if (!fn) return null;

    const sig = new vscode.SignatureInformation(
      formatSignature(call.name, fn),
      new vscode.MarkdownString(fn.description),
    );
    sig.parameters = fn.params.map((p) => {
      let label = p.name;
      if (!p.required) label += "?";
      if (p.default !== undefined) label += `=${p.default}`;
      return new vscode.ParameterInformation(label);
    });

    const help = new vscode.SignatureHelp();
    help.signatures = [sig];
    help.activeSignature = 0;
    help.activeParameter = Math.min(
      call.activeIndex,
      Math.max(0, fn.params.length - 1),
    );
    return help;
  }
}
