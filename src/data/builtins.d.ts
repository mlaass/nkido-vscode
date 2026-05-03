// Type declarations for the bundled builtins.json artifact (synced from
// `nkido/web/static/generated/builtins.json` via scripts/sync-builtins.js).

export interface BuiltinParam {
  name: string;
  required: boolean;
  default?: number;
}

export interface BuiltinFunction {
  params: BuiltinParam[];
  description: string;
  requires_state: boolean;
}

export interface BuiltinsData {
  functions: Record<string, BuiltinFunction>;
  aliases: Record<string, string>;
  keywords: string[];
}
