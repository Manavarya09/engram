/**
 * engram — programmatic surface.
 *
 * Re-exports the five primitives and the session bootstrap so library
 * consumers can drive engram directly from TypeScript without the CLI.
 */

export { grep } from "./primitives/grep.ts";
export { read } from "./primitives/read.ts";
export { ast } from "./primitives/ast.ts";
export { git } from "./primitives/git.ts";
export { recurse } from "./primitives/recurse.ts";

export { resolveConfig } from "./engine/session.ts";
export { appendJournal, readJournal, hashResult, previewResult } from "./engine/journal.ts";
export { run } from "./engine/runner.ts";

export type {
  PrimitiveName,
  PrimitiveOutput,
  PrimitiveResult,
  PrimitiveError,
  EngramConfig,
  JournalEntry,
  GrepArgs,
  GrepHit,
  ReadArgs,
  ReadResult,
  AstArgs,
  AstQuery,
  AstResult,
  AstSymbol,
  GitArgs,
  GitMode,
  GitResult,
  GitLogEntry,
  GitBlameLine,
  RecurseArgs,
  RecurseResult,
  RecurseSnippet,
} from "./types.ts";
