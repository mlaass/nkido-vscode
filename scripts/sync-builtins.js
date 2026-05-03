#!/usr/bin/env node
/**
 * Copy builtins.json from the sibling nkido repo into src/data/.
 *
 * Default source location: ../nkido/web/static/generated/builtins.json
 * Override the nkido repo location with the NKIDO_REPO environment variable.
 *
 * To regenerate the source artifact, run in the nkido repo:
 *   cd web && bun run build:builtins-json
 */
const { copyFileSync, existsSync, mkdirSync } = require("fs");
const { resolve, dirname } = require("path");

const NKIDO_REPO = process.env.NKIDO_REPO || resolve(__dirname, "../../nkido");
const SRC = resolve(NKIDO_REPO, "web/static/generated/builtins.json");
const DST = resolve(__dirname, "../src/data/builtins.json");

if (!existsSync(SRC)) {
  console.error(`Cannot find ${SRC}.`);
  console.error(`Set NKIDO_REPO to the absolute path of your nkido checkout, then run:`);
  console.error(`  cd "$NKIDO_REPO/web" && bun run build:builtins-json`);
  process.exit(1);
}

mkdirSync(dirname(DST), { recursive: true });
copyFileSync(SRC, DST);
console.log(`Copied ${SRC} -> ${DST}`);
