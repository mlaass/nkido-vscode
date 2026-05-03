# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A VS Code extension (`publisher: moritzlaass`, id `nkido`) that adds language support for **Akkado**, the live-coding DSL from the sibling [nkido](../nkido) repo. It does not embed a synth — all execution goes through the `nkido-cli` binary built from that repo.

## Build & dev commands

```sh
npm install
npm run sync-builtins       # copy builtins.json from $NKIDO_REPO (default ../nkido)
npm run build:grammar       # generate syntaxes/akkado.tmLanguage.json from builtins.json
npm run compile             # tsc → out/
npm run watch               # tsc -w
npm run vscode:prepublish   # sync-builtins + build:grammar + compile
npm run package             # vsce package → .vsix
```

There is no test suite. To run the extension live, open this folder in VS Code and press `F5` (Extension Development Host).

## How it depends on the nkido repo

Two artifacts flow in from `../nkido` (override location with `NKIDO_REPO=/abs/path`):

1. **`nkido-cli` binary** — runtime dependency. Built via `cmake --build build --target nkido-cli` in the nkido repo. Either on `PATH` or pointed at via the `nkido.cliPath` setting.
2. **`web/static/generated/builtins.json`** — build-time dependency. Regenerate in nkido with `cd web && bun run build:builtins-json`, then `npm run sync-builtins` here.

`builtins.json` drives **both** the in-editor IntelliSense (`src/data/`, consumed by completion + signature providers) **and** the TextMate grammar (`scripts/build-grammar.js` reads it to generate the keyword/builtin alternations). Re-running `build:grammar` is required after any sync, otherwise the grammar will lag the language.

The completion regexes and the `%` hole / chord (`C4'`) / directive (`$foo`) tokenizer rules are deliberate ports of the web IDE's logic in `nkido/web/src/lib/editor/` (`akkado-completions.ts`, `akkado-language.ts`). When the web tokenizer changes, mirror it here.

## Architecture

`src/extension.ts` wires up two distinct CLI integration paths — they exist for different reasons and should not be merged:

- **`src/cli/serve-mode-manager.ts` — persistent `nkido-cli serve` process.** One per workspace, lazily spawned, newline-delimited JSON over stdio. Used for `nkido.evaluate` (Ctrl/Cmd+Enter) and `nkido.stop` (Escape). The persistence is what enables glitch-free hot-swap: killing/respawning would interrupt audio. Compile diagnostics for the loaded program arrive via `diagnostic` events keyed on the document URI passed to `load()`. On crash the process handle is cleared so the next command transparently respawns.
- **`src/cli/cli-client.ts` — spawn-per-command.** Used for `nkido.check` (also auto-fires on save when `nkido.autoCompileOnSave` is on) and `nkido.compile`. Output goes via stderr as newline-delimited JSON; `parseDiagnosticsBlob` is tolerant of non-JSON noise.

The `NkidoDiagnostic` shape in `src/providers/diagnostic-provider.ts` mirrors `akkado::format_diagnostic_json` in the nkido C++ source. Lines/characters are 0-indexed on the wire (matches VS Code's `Range`). If the C++ diagnostic format changes, update `NkidoDiagnostic` and `toVscodeDiagnostic` in lockstep.

`SignatureHelpProvider` walks the source backwards from the cursor tracking `()`, `{}`, `[]`, and string state to find the unmatched open paren — top-level commas inside it determine `activeParameter`. It is intentionally string- and bracket-aware; do not reduce it to a regex.

## File map (only the non-obvious bits)

- `src/data/builtins.json` — generated, do not hand-edit (sync from nkido).
- `syntaxes/akkado.tmLanguage.json` — generated, do not hand-edit (run `build:grammar`).
- `src/data/builtins.d.ts` — hand-written types for the generated JSON.
- `src/commands/`, `src/syntax/` — currently empty placeholders.

## Settings surface

`nkido.cliPath`, `nkido.autoCompileOnSave`, `nkido.audio.sampleRate`, `nkido.audio.bufferSize`, `nkido.diagnostics.enabled` — declared in `package.json` and read in `src/utils/config.ts`. Adding a setting requires updating both.
