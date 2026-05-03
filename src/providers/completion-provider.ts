import * as vscode from "vscode";
import { builtins, formatSignature } from "../data";

const KEYWORDS_FILTER = new Set(["fn", "true", "false", "match"]);

interface UserFunction {
  name: string;
  params: string[];
  docstring?: string;
}

// Regex ported from web/src/lib/editor/akkado-completions.ts (variables L93,
// functions L118). Matches at line start or after `;`.
const VAR_PATTERN = /(?:^|[;\n])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=/gm;
const FN_PATTERN =
  /(?:\/\/\/\s*(.+?)\n)?fn\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)/g;

function extractUserVariables(code: string): string[] {
  const out = new Set<string>();
  VAR_PATTERN.lastIndex = 0;
  let m;
  while ((m = VAR_PATTERN.exec(code)) !== null) {
    const name = m[1];
    if (!KEYWORDS_FILTER.has(name)) out.add(name);
  }
  return Array.from(out);
}

function extractUserFunctions(code: string): UserFunction[] {
  const out: UserFunction[] = [];
  FN_PATTERN.lastIndex = 0;
  let m;
  while ((m = FN_PATTERN.exec(code)) !== null) {
    out.push({
      name: m[2],
      params: m[3]
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
      docstring: m[1]?.trim(),
    });
  }
  return out;
}

export class CompletionProvider implements vscode.CompletionItemProvider {
  static readonly triggerCharacters = ['"', "."];

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    context: vscode.CompletionContext,
  ): vscode.CompletionItem[] {
    const text = document.getText();
    const wordRange = document.getWordRangeAtPosition(
      position,
      /[a-zA-Z_][a-zA-Z0-9_]*/,
    );
    const word = wordRange ? document.getText(wordRange) : "";

    // Match the web IDE's gating: skip if nothing typed yet and not explicit.
    if (
      !wordRange &&
      context.triggerKind !== vscode.CompletionTriggerKind.Invoke
    ) {
      return [];
    }
    if (
      word.length < 2 &&
      context.triggerKind !== vscode.CompletionTriggerKind.Invoke
    ) {
      return [];
    }

    const items: vscode.CompletionItem[] = [];

    // Builtins
    for (const [name, info] of Object.entries(builtins.functions)) {
      const item = new vscode.CompletionItem(
        name,
        vscode.CompletionItemKind.Function,
      );
      item.detail = formatSignature(name, info);
      item.documentation = new vscode.MarkdownString(info.description);
      item.insertText = new vscode.SnippetString(`${name}($0)`);
      items.push(item);
    }

    // Aliases — point to canonical name in detail
    for (const [alias, canonical] of Object.entries(builtins.aliases)) {
      const fn = builtins.functions[canonical];
      if (!fn) continue;
      const item = new vscode.CompletionItem(
        alias,
        vscode.CompletionItemKind.Function,
      );
      item.detail = `→ ${canonical}`;
      item.documentation = new vscode.MarkdownString(fn.description);
      item.insertText = new vscode.SnippetString(`${alias}($0)`);
      // Sort aliases below their canonical equivalents.
      item.sortText = `z_${alias}`;
      items.push(item);
    }

    // Keywords
    for (const kw of builtins.keywords) {
      const item = new vscode.CompletionItem(
        kw,
        vscode.CompletionItemKind.Keyword,
      );
      item.sortText = `y_${kw}`;
      items.push(item);
    }

    // User-defined functions (highest priority)
    for (const fn of extractUserFunctions(text)) {
      const item = new vscode.CompletionItem(
        fn.name,
        vscode.CompletionItemKind.Function,
      );
      item.detail = `${fn.name}(${fn.params.join(", ")})`;
      if (fn.docstring) {
        item.documentation = new vscode.MarkdownString(fn.docstring);
      }
      item.insertText = new vscode.SnippetString(`${fn.name}($0)`);
      item.sortText = `0_${fn.name}`;
      items.push(item);
    }

    // User-defined variables
    for (const name of extractUserVariables(text)) {
      const item = new vscode.CompletionItem(
        name,
        vscode.CompletionItemKind.Variable,
      );
      item.sortText = `1_${name}`;
      items.push(item);
    }

    return items;
  }
}
