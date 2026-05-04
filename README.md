# Nkido (Akkado) for VS Code

Live-coding support for the [Akkado](https://github.com/) DSL: syntax highlighting, autocomplete with signatures, real-time diagnostics, and hot-swap audio playback through `nkido-cli`.

## Features

- Syntax highlighting for `.akkado` and `.akk` files
- Autocomplete for ~190 builtins, ~30 aliases, user-defined `fn`/variables
- Signature help when typing function calls
- Squiggly error underlines + Problems panel via `nkido-cli check --json`
- `Ctrl+Enter` (`Cmd+Enter` on macOS) to evaluate / hot-swap; `Escape` to stop
- Persistent `nkido-cli serve` process per workspace for glitch-free live coding

## Prerequisites

You need a `nkido-cli` binary built with the `serve` subcommand. Build it from the [nkido repo](https://github.com/mlaass/nkido):

```sh
cd /path/to/nkido
cmake -B build
cmake --build build --target nkido-cli
# Resulting binary: build/tools/nkido-cli/nkido-cli
```

Either put `nkido-cli` on your `PATH`, or set `nkido.cliPath` in VS Code settings to the absolute path.

## Building from source

This extension's grammar and builtin metadata are derived from the nkido repo. By default it expects the repos to be siblings (`../nkido`); override with `NKIDO_REPO=/path/to/nkido`.

```sh
# In the nkido repo, regenerate the metadata artifact:
cd nkido/web && bun run build:builtins-json

# In this repo, sync + build:
npm install
npm run sync-builtins      # copies builtins.json from ../nkido
npm run build:grammar      # generates syntaxes/akkado.tmLanguage.json
npm run compile            # compiles TypeScript to out/

# Or all-in-one:
npm run vscode:prepublish
```

To run the extension during development: open this folder in VS Code and press `F5`.

To package: `npm run package` (produces a `.vsix`).

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `nkido.cliPath` | _(PATH lookup)_ | Absolute path to `nkido-cli` |
| `nkido.autoCompileOnSave` | `false` | Refresh diagnostics on save |
| `nkido.audio.sampleRate` | `48000` | Sample rate forwarded to `nkido-cli serve` |
| `nkido.audio.bufferSize` | `128` | Buffer size forwarded to `nkido-cli serve` |
| `nkido.diagnostics.enabled` | `true` | Show squiggly underlines and Problems entries |

## Commands

- `Nkido: Evaluate / Play` — compile and start (or hot-swap) audio (`Ctrl+Enter`)
- `Nkido: Stop` — stop playback (`Escape`)
- `Nkido: Compile to Bytecode` — write `.cedar` next to source
- `Nkido: Check Syntax` — run `check --json`, refresh diagnostics
- `Nkido: Show Output` — focus the Nkido output channel
- `Nkido: Restart CLI` — kill the persistent `serve` process

## File icons

The icons in `icons/` are placeholders (a stylized "A" over a sine wave). Replace before publishing.
