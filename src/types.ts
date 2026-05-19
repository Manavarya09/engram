/**
 * Core types for the engram Recursive Language Model engine.
 *
 * The contract: every primitive accepts a scoped, bounded input and returns
 * a small, structured slice. Nothing in engram ever returns "the whole file"
 * or "all results". Bounded outputs are how we maintain RLM discipline —
 * the model navigates programmatically instead of soaking in raw context.
 */

export type PrimitiveName =
  | "grep"
  | "read"
  | "ast"
  | "git"
  | "recurse";

export interface JournalEntry {
  readonly id: string;
  readonly ts: string;
  readonly primitive: PrimitiveName;
  readonly args: Readonly<Record<string, unknown>>;
  readonly resultHash: string;
  readonly resultPreview: string;
  readonly durationMs: number;
  readonly cwd: string;
  readonly sessionId: string;
  readonly callerHint?: string;
}

export interface PrimitiveResult<T = unknown> {
  readonly primitive: PrimitiveName;
  readonly ok: boolean;
  readonly data: T;
  readonly truncated: boolean;
  readonly bytes: number;
  readonly durationMs: number;
  readonly journalId: string;
}

export interface PrimitiveError {
  readonly primitive: PrimitiveName;
  readonly ok: false;
  readonly error: string;
  readonly hint?: string;
  readonly journalId: string;
}

export type PrimitiveOutput<T = unknown> = PrimitiveResult<T> | PrimitiveError;

export interface GrepHit {
  readonly file: string;
  readonly line: number;
  readonly col: number;
  readonly text: string;
  readonly context: { readonly before: readonly string[]; readonly after: readonly string[] };
}

export interface GrepArgs {
  readonly pattern: string;
  readonly path?: string;
  readonly glob?: string;
  readonly maxHits?: number;
  readonly contextLines?: number;
  readonly caseSensitive?: boolean;
}

export interface ReadArgs {
  readonly file: string;
  readonly fromLine: number;
  readonly toLine: number;
}

export interface ReadResult {
  readonly file: string;
  readonly fromLine: number;
  readonly toLine: number;
  readonly totalLines: number;
  readonly lines: readonly string[];
}

export type AstQuery =
  | { readonly kind: "functions" }
  | { readonly kind: "classes" }
  | { readonly kind: "exports" }
  | { readonly kind: "imports" }
  | { readonly kind: "symbol-at"; readonly line: number; readonly col: number };

export interface AstArgs {
  readonly file: string;
  readonly query: AstQuery;
}

export interface AstSymbol {
  readonly name: string;
  readonly kind: string;
  readonly line: number;
  readonly endLine: number;
  readonly signature?: string;
  readonly exported?: boolean;
}

export interface AstResult {
  readonly file: string;
  readonly query: AstQuery;
  readonly symbols: readonly AstSymbol[];
}

export type GitMode = "blame" | "log" | "diff";

export interface GitArgs {
  readonly mode: GitMode;
  readonly file?: string;
  readonly since?: string;
  readonly maxEntries?: number;
  readonly ref?: string;
}

export interface GitLogEntry {
  readonly sha: string;
  readonly author: string;
  readonly date: string;
  readonly subject: string;
}

export interface GitBlameLine {
  readonly line: number;
  readonly sha: string;
  readonly author: string;
  readonly date: string;
  readonly text: string;
}

export type GitResult =
  | { readonly mode: "log"; readonly entries: readonly GitLogEntry[] }
  | { readonly mode: "blame"; readonly file: string; readonly lines: readonly GitBlameLine[] }
  | { readonly mode: "diff"; readonly ref: string; readonly file?: string; readonly diff: string };

export interface RecurseArgs {
  readonly prompt: string;
  readonly snippets: readonly RecurseSnippet[];
  readonly maxTokens?: number;
}

export interface RecurseSnippet {
  readonly source: string;
  readonly content: string;
}

export interface RecurseResult {
  readonly prompt: string;
  readonly conclusion: string;
  readonly snippetCount: number;
  readonly recurseId: string;
  readonly mode: "delegation-request";
}

export interface EngramConfig {
  readonly cwd: string;
  readonly journalPath: string;
  readonly sessionId: string;
  readonly maxResultBytes: number;
  readonly maxRecurseDepth: number;
  readonly recurseDepth: number;
}

export const DEFAULT_CONFIG: Omit<EngramConfig, "cwd" | "journalPath" | "sessionId"> = {
  maxResultBytes: 64 * 1024,
  maxRecurseDepth: 4,
  recurseDepth: 0,
};
