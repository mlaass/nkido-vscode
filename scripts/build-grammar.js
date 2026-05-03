#!/usr/bin/env node
/**
 * Build a TextMate grammar for Akkado from src/data/builtins.json.
 *
 * Tokens map to scopes that match the web IDE's CodeMirror highlighting
 * intent (web/src/lib/editor/akkado-language.ts). Run after sync-builtins.js.
 */
const { readFileSync, writeFileSync, mkdirSync } = require("fs");
const { resolve, dirname } = require("path");

const BUILTINS = resolve(__dirname, "../src/data/builtins.json");
const OUT = resolve(__dirname, "../syntaxes/akkado.tmLanguage.json");

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const data = JSON.parse(readFileSync(BUILTINS, "utf8"));
const builtinNames = Object.keys(data.functions || {}).sort(
  (a, b) => b.length - a.length,  // longest-first for safe alternation
);
const aliasNames = Object.keys(data.aliases || {}).sort(
  (a, b) => b.length - a.length,
);
const allBuiltins = [...new Set([...builtinNames, ...aliasNames])];
const keywords = (data.keywords || []).slice().sort((a, b) => b.length - a.length);

const grammar = {
  $schema: "https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json",
  scopeName: "source.akkado",
  fileTypes: ["akkado", "akk"],
  name: "Akkado",
  patterns: [
    { include: "#comments" },
    { include: "#strings" },
    { include: "#numbers" },
    { include: "#chord" },
    { include: "#directive" },
    { include: "#rest" },
    { include: "#hole" },
    { include: "#keywords" },
    { include: "#builtins" },
    { include: "#operators" },
  ],
  repository: {
    comments: {
      patterns: [
        {
          match: "//.*$",
          name: "comment.line.double-slash.akkado",
        },
      ],
    },
    strings: {
      name: "string.quoted.double.akkado",
      begin: '"',
      end: '"',
      patterns: [
        { match: "\\\\.", name: "constant.character.escape.akkado" },
      ],
    },
    numbers: {
      patterns: [
        {
          match: "\\b\\d+\\.\\d+([eE][+-]?\\d+)?\\b",
          name: "constant.numeric.float.akkado",
        },
        {
          match: "\\.\\d+([eE][+-]?\\d+)?\\b",
          name: "constant.numeric.float.akkado",
        },
        {
          match: "\\b\\d+([eE][+-]?\\d+)?\\b",
          name: "constant.numeric.integer.akkado",
        },
      ],
    },
    chord: {
      // Identifier ending with a single quote: chord notation like C4', Am7', F#m_4'.
      patterns: [
        {
          match: "[A-Ga-g][#b]?[A-Za-z0-9_]*'",
          name: "string.other.chord.akkado",
        },
      ],
    },
    directive: {
      patterns: [
        {
          match: "\\$\\w+",
          name: "meta.preprocessor.akkado",
        },
      ],
    },
    rest: {
      patterns: [
        {
          match: "~",
          name: "constant.language.rest.akkado",
        },
      ],
    },
    hole: {
      patterns: [
        {
          // `%` as a hole — only when not followed by a word char (to avoid
          // matching modulo-like uses). The web tokenizer makes the same call.
          match: "%(?![A-Za-z0-9_])",
          name: "variable.language.hole.akkado",
        },
      ],
    },
    keywords: {
      patterns: [
        {
          match: `\\b(${keywords.map(escapeRe).join("|")})\\b`,
          name: "keyword.control.akkado",
        },
      ],
    },
    builtins: {
      patterns: [
        {
          match: `\\b(${allBuiltins.map(escapeRe).join("|")})\\b`,
          name: "support.function.builtin.akkado",
        },
      ],
    },
    operators: {
      patterns: [
        {
          // Multi-char operators first
          match: "\\|>|->|==|!=|<=|>=|&&|\\|\\|",
          name: "keyword.operator.akkado",
        },
        {
          match: "[+\\-*/^=<>!?|.@]",
          name: "keyword.operator.akkado",
        },
      ],
    },
  },
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(grammar, null, 2) + "\n");
console.log(
  `Wrote ${OUT} (${allBuiltins.length} builtins+aliases, ${keywords.length} keywords)`,
);
