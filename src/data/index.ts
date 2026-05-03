import builtinsRaw from "./builtins.json";
import type { BuiltinFunction, BuiltinsData } from "./builtins";

export const builtins: BuiltinsData = builtinsRaw as BuiltinsData;
export type { BuiltinParam, BuiltinFunction, BuiltinsData } from "./builtins";

/**
 * Format a builtin's signature as a human-readable string, e.g.:
 *   `lp(in, cut, q?=0.707)`
 */
export function formatSignature(name: string, fn: BuiltinFunction): string {
  const parts = fn.params.map((p) => {
    let s = p.name;
    if (!p.required) s += "?";
    if (p.default !== undefined) s += `=${p.default}`;
    return s;
  });
  return `${name}(${parts.join(", ")})`;
}
