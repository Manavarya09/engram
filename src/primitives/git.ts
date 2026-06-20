/**
 * git — bounded views over git history. Uses spawnSync with a fixed argv
 * (never a shell), so user-supplied refs / files / since-strings cannot
 * escape into command injection.
 *
 * Modes:
 *   - log    → recent commits (oneline-ish) for the repo or a single file
 *   - blame  → per-line authorship for a file, parsed from --porcelain
 *   - diff   → ref or staged/unstaged diff, optionally filtered to a file
 *
 * Every output is line-capped (logs/blame) or byte-budgeted via the runner.
 */

import { spawnSync } from "node:child_process";
import { resolve, sep } from "node:path";

import { run } from "../engine/runner.ts";
import type {
  EngramConfig,
  GitArgs,
  GitBlameLine,
  GitLogEntry,
  GitResult,
  PrimitiveOutput,
} from "../types.ts";

const DEFAULT_LOG_MAX = 30;
const DEFAULT_BLAME_MAX_LINES = 400;
const DIFF_BYTE_CAP = 32 * 1024;

export async function git(
  args: GitArgs,
  config: EngramConfig,
): Promise<PrimitiveOutput<GitResult>> {
  return run({
    primitive: "git",
    args: args as unknown as Readonly<Record<string, unknown>>,
    config,
    task: () => {
      const cwd = config.cwd;
      switch (args.mode) {
        case "log":
          return gitLog(cwd, args);
        case "blame":
          return gitBlame(cwd, args);
        case "diff":
          return gitDiff(cwd, args);
      }
    },
  });
}

function runGit(cwd: string, argv: readonly string[]): { stdout: string; stderr: string; code: number } {
  const r = spawnSync("git", argv, {
    cwd,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  if (r.error) throw r.error;
  return { stdout: r.stdout ?? "", stderr: r.stderr ?? "", code: r.status ?? 0 };
}

function gitLog(cwd: string, args: GitArgs): GitResult {
  const max = args.maxEntries ?? DEFAULT_LOG_MAX;
  const argv: string[] = [
    "log",
    `-n`,
    String(max),
    "--pretty=format:%H%x09%an%x09%aI%x09%s",
  ];
  if (args.since) argv.push(`--since=${args.since}`);
  if (args.file) {
    argv.push("--", resolveFile(cwd, args.file));
  }
  const { stdout, code, stderr } = runGit(cwd, argv);
  if (code !== 0) {
    throw new Error(`git log failed: ${stderr.trim() || `exit ${code}`}`);
  }
  const entries: GitLogEntry[] = [];
  for (const line of stdout.split("\n")) {
    if (!line) continue;
    const parts = line.split("\t");
    if (parts.length < 4) continue;
    const sha = parts[0] ?? "";
    const author = parts[1] ?? "";
    const date = parts[2] ?? "";
    const subject = parts.slice(3).join("\t");
    entries.push({ sha, author, date, subject });
  }
  return { mode: "log", entries };
}

function gitBlame(cwd: string, args: GitArgs): GitResult {
  if (!args.file) throw new Error("blame requires { file }");
  const file = resolveFile(cwd, args.file);
  const { stdout, code, stderr } = runGit(cwd, ["blame", "--porcelain", file]);
  if (code !== 0) {
    throw new Error(`git blame failed: ${stderr.trim() || `exit ${code}`}`);
  }

  const lines: GitBlameLine[] = [];
  let curSha = "";
  let curAuthor = "";
  let curDate = "";
  let curLine = 0;
  let i = 0;
  const split = stdout.split("\n");
  while (i < split.length) {
    const line = split[i] ?? "";
    if (/^[0-9a-f]{40} /.test(line)) {
      const parts = line.split(" ");
      curSha = parts[0] ?? "";
      const ln = parts[2] ? Number(parts[2]) : 0;
      curLine = ln;
      i += 1;
      while (i < split.length) {
        const meta = split[i] ?? "";
        if (meta.startsWith("\t")) {
          break;
        }
        if (meta.startsWith("author ")) {
          curAuthor = meta.slice("author ".length);
        } else if (meta.startsWith("author-time ")) {
          const epoch = Number(meta.slice("author-time ".length));
          if (Number.isFinite(epoch)) {
            curDate = new Date(epoch * 1000).toISOString();
          }
        }
        i += 1;
      }
      const code = split[i] ?? "";
      lines.push({
        line: curLine,
        sha: curSha,
        author: curAuthor,
        date: curDate,
        text: code.startsWith("\t") ? code.slice(1) : code,
      });
      if (lines.length >= DEFAULT_BLAME_MAX_LINES) break;
    }
    i += 1;
  }
  return { mode: "blame", file: args.file, lines };
}

function gitDiff(cwd: string, args: GitArgs): GitResult {
  const ref = args.ref ?? "HEAD";
  const argv: string[] = ["diff", ref];
  if (args.file) argv.push("--", resolveFile(cwd, args.file));
  const { stdout, code, stderr } = runGit(cwd, argv);
  if (code !== 0) {
    throw new Error(`git diff failed: ${stderr.trim() || `exit ${code}`}`);
  }
  const diff = stdout.length > DIFF_BYTE_CAP
    ? `${stdout.slice(0, DIFF_BYTE_CAP)}\n…(diff truncated, +${stdout.length - DIFF_BYTE_CAP}B)`
    : stdout;
  if (args.file === undefined) {
    return { mode: "diff", ref, diff };
  }
  return { mode: "diff", ref, file: args.file, diff };
}

function resolveFile(cwd: string, file: string): string {
  // Defense in depth: even though we use argv (no shell), force the path
  // into the repo root so an absolute or .. path can't reference outside cwd.
  const r = resolve(cwd, file);
  if (r !== cwd && !r.startsWith(cwd + sep)) {
    throw new Error(`path escapes cwd: ${file}`);
  }
  return r;
}
