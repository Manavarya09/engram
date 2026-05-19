#!/usr/bin/env -S node --experimental-strip-types --no-warnings
/**
 * engram CLI — argv -> primitive dispatch, structured output.
 *
 * Every subcommand writes its result (or error) to stdout as JSON unless
 * --human is set, in which case a compact pretty-print is emitted. Exit
 * codes:
 *   0   — primitive returned ok
 *   2   — primitive returned an error result (still wrote JSON)
 *   64  — argv parse error / unknown subcommand
 *   1   — unexpected throw
 *
 * Stable, machine-readable output is non-negotiable: this CLI's primary
 * consumer is the parent Claude running /engram, which parses the JSON
 * to drive its next REPL turn.
 */

import { readFileSync } from "node:fs";

import { grep } from "./primitives/grep.ts";
import { read } from "./primitives/read.ts";
import { ast } from "./primitives/ast.ts";
import { git } from "./primitives/git.ts";
import { recurse } from "./primitives/recurse.ts";
import { resolveConfig } from "./engine/session.ts";
import { readJournal } from "./engine/journal.ts";
import type {
  AstQuery,
  EngramConfig,
  GitMode,
  PrimitiveName,
  PrimitiveOutput,
  RecurseSnippet,
} from "./types.ts";

const HELP = `engram — Recursive Language Model engine for Claude Code.

Usage:
  engram grep    <pattern> [--path P] [--glob G] [--max N] [--ctx N] [--case]
  engram read    <file> <fromLine> <toLine>
  engram ast     <file> <query>
                 query: functions | classes | exports | imports
                        | symbol-at:LINE:COL
  engram git     log    [--file F] [--since S] [--max N]
  engram git     blame  --file F
  engram git     diff   [--ref R] [--file F]
  engram recurse <promptFile> <snippetsJsonFile>
  engram journal [--session S] [--primitive P] [--tail N]
  engram session
  engram init

Global flags:
  --cwd <dir>    Override working directory (default: \$PWD)
  --json         Force JSON output (default for non-TTY)
  --human        Force pretty output
  --recurse-depth N   Internal: set current recurse depth

Engram never returns whole files. Every call is journaled to .engram/journal.jsonl.
`;

interface ParsedArgs {
  readonly sub: string;
  readonly positionals: readonly string[];
  readonly flags: Readonly<Record<string, string | true>>;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const sub = argv[0] ?? "";
  const rest = argv.slice(1);
  const positionals: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i] ?? "";
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = rest[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i += 1;
      } else {
        flags[key] = true;
      }
    } else {
      positionals.push(a);
    }
  }
  return { sub, positionals, flags };
}

function configFromFlags(flags: Readonly<Record<string, string | true>>): EngramConfig {
  const cwd = typeof flags["cwd"] === "string" ? flags["cwd"] : process.cwd();
  const overrides: { -readonly [K in keyof EngramConfig]?: EngramConfig[K] } = { cwd };
  if (typeof flags["recurse-depth"] === "string") {
    const n = Number(flags["recurse-depth"]);
    if (Number.isFinite(n) && n >= 0) {
      overrides.recurseDepth = n;
    }
  }
  return resolveConfig(overrides);
}

function emit(output: unknown, flags: Readonly<Record<string, string | true>>): void {
  const wantHuman = flags["human"] === true && flags["json"] !== true;
  if (wantHuman) {
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(output)}\n`);
  }
}

function exitFor(out: PrimitiveOutput): number {
  return out.ok ? 0 : 2;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h" || argv[0] === "help") {
    process.stdout.write(HELP);
    return 0;
  }
  const parsed = parseArgs(argv);
  const config = configFromFlags(parsed.flags);

  switch (parsed.sub) {
    case "grep":
      return runGrep(parsed, config);
    case "read":
      return runRead(parsed, config);
    case "ast":
      return runAst(parsed, config);
    case "git":
      return runGit(parsed, config);
    case "recurse":
      return runRecurse(parsed, config);
    case "journal":
      return runJournal(parsed, config);
    case "session":
      emit({ sessionId: config.sessionId, journalPath: config.journalPath, cwd: config.cwd }, parsed.flags);
      return 0;
    case "init":
      return runInit(parsed, config);
    default:
      process.stderr.write(`unknown subcommand: ${parsed.sub}\n${HELP}`);
      return 64;
  }
}

async function runGrep(p: ParsedArgs, config: EngramConfig): Promise<number> {
  const pattern = p.positionals[0];
  if (!pattern) {
    process.stderr.write("engram grep: missing <pattern>\n");
    return 64;
  }
  const args = {
    pattern,
    ...(typeof p.flags["path"] === "string" ? { path: p.flags["path"] } : {}),
    ...(typeof p.flags["glob"] === "string" ? { glob: p.flags["glob"] } : {}),
    ...(typeof p.flags["max"] === "string" ? { maxHits: Number(p.flags["max"]) } : {}),
    ...(typeof p.flags["ctx"] === "string" ? { contextLines: Number(p.flags["ctx"]) } : {}),
    ...(p.flags["case"] === true ? { caseSensitive: true } : {}),
  };
  const out = await grep(args, config);
  emit(out, p.flags);
  return exitFor(out);
}

async function runRead(p: ParsedArgs, config: EngramConfig): Promise<number> {
  const file = p.positionals[0];
  const fromStr = p.positionals[1];
  const toStr = p.positionals[2];
  if (!file || !fromStr || !toStr) {
    process.stderr.write("engram read: usage: read <file> <fromLine> <toLine>\n");
    return 64;
  }
  const out = await read({ file, fromLine: Number(fromStr), toLine: Number(toStr) }, config);
  emit(out, p.flags);
  return exitFor(out);
}

async function runAst(p: ParsedArgs, config: EngramConfig): Promise<number> {
  const file = p.positionals[0];
  const qStr = p.positionals[1];
  if (!file || !qStr) {
    process.stderr.write("engram ast: usage: ast <file> <query>\n");
    return 64;
  }
  let query: AstQuery;
  if (qStr === "functions" || qStr === "classes" || qStr === "exports" || qStr === "imports") {
    query = { kind: qStr };
  } else if (qStr.startsWith("symbol-at:")) {
    const parts = qStr.slice("symbol-at:".length).split(":");
    const line = Number(parts[0]);
    const col = Number(parts[1] ?? "1");
    if (!Number.isFinite(line) || !Number.isFinite(col)) {
      process.stderr.write("engram ast: symbol-at requires LINE:COL\n");
      return 64;
    }
    query = { kind: "symbol-at", line, col };
  } else {
    process.stderr.write(`engram ast: unknown query "${qStr}"\n`);
    return 64;
  }
  const out = await ast({ file, query }, config);
  emit(out, p.flags);
  return exitFor(out);
}

async function runGit(p: ParsedArgs, config: EngramConfig): Promise<number> {
  const modeStr = p.positionals[0];
  if (modeStr !== "log" && modeStr !== "blame" && modeStr !== "diff") {
    process.stderr.write("engram git: mode must be log | blame | diff\n");
    return 64;
  }
  const mode = modeStr as GitMode;
  const args = {
    mode,
    ...(typeof p.flags["file"] === "string" ? { file: p.flags["file"] } : {}),
    ...(typeof p.flags["since"] === "string" ? { since: p.flags["since"] } : {}),
    ...(typeof p.flags["max"] === "string" ? { maxEntries: Number(p.flags["max"]) } : {}),
    ...(typeof p.flags["ref"] === "string" ? { ref: p.flags["ref"] } : {}),
  };
  const out = await git(args, config);
  emit(out, p.flags);
  return exitFor(out);
}

async function runRecurse(p: ParsedArgs, config: EngramConfig): Promise<number> {
  const promptFile = p.positionals[0];
  const snippetsFile = p.positionals[1];
  if (!promptFile || !snippetsFile) {
    process.stderr.write("engram recurse: usage: recurse <promptFile> <snippetsJsonFile>\n");
    return 64;
  }
  const prompt = readFileSync(promptFile, "utf8").trim();
  const snippetsRaw = readFileSync(snippetsFile, "utf8");
  const snippets = JSON.parse(snippetsRaw) as readonly RecurseSnippet[];
  const out = await recurse({ prompt, snippets }, config);
  emit(out, p.flags);
  return exitFor(out);
}

function runJournal(p: ParsedArgs, config: EngramConfig): number {
  const reader = readJournal(config.journalPath);
  let entries = reader.entries();
  if (typeof p.flags["session"] === "string") {
    entries = reader.bySession(p.flags["session"]);
  }
  if (typeof p.flags["primitive"] === "string") {
    const prim = p.flags["primitive"] as PrimitiveName;
    entries = entries.filter((e) => e.primitive === prim);
  }
  const tailN = typeof p.flags["tail"] === "string" ? Number(p.flags["tail"]) : null;
  if (tailN !== null && Number.isFinite(tailN) && tailN > 0) {
    entries = entries.slice(-tailN);
  }
  emit({ count: entries.length, size: reader.size(), entries }, p.flags);
  return 0;
}

function runInit(p: ParsedArgs, config: EngramConfig): number {
  // Touch the journal so the .engram/ dir is created. Subsequent primitive
  // calls would auto-create it anyway; init makes the first state explicit.
  const reader = readJournal(config.journalPath);
  emit(
    {
      ok: true,
      cwd: config.cwd,
      journalPath: config.journalPath,
      sessionId: config.sessionId,
      existingEntries: reader.count(),
      message: "engram ready",
    },
    p.flags,
  );
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    process.stderr.write(`engram: unexpected error: ${(e as Error).message ?? e}\n`);
    process.exit(1);
  });
