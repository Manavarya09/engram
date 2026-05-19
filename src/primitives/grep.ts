/**
 * grep — bounded text search across a path, returning file:line:col hits
 * with N lines of context. Skips node_modules, .git, dist, build, .next.
 *
 * Pure JS, walks the tree with fs.readdir. For most repos this is plenty fast;
 * a ripgrep backend can be added in v0.1 if benchmarks demand.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";

import { run } from "../engine/runner.ts";
import type { EngramConfig, GrepArgs, GrepHit, PrimitiveOutput } from "../types.ts";

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".nuxt",
  ".turbo",
  ".vercel",
  ".cache",
  "coverage",
  ".engram",
]);

const SKIP_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".mp3", ".mp4", ".mov", ".webm", ".ogg",
  ".zip", ".tar", ".gz", ".7z", ".rar",
  ".lock", ".bin", ".wasm",
]);

const DEFAULT_MAX_HITS = 50;
const DEFAULT_CONTEXT = 2;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

export interface GrepData {
  readonly pattern: string;
  readonly hits: readonly GrepHit[];
  readonly filesScanned: number;
  readonly hitsCapped: boolean;
}

export async function grep(
  args: GrepArgs,
  config: EngramConfig,
): Promise<PrimitiveOutput<GrepData>> {
  return run({
    primitive: "grep",
    args: args as unknown as Readonly<Record<string, unknown>>,
    config,
    task: () => {
      const root = resolve(config.cwd, args.path ?? ".");
      const maxHits = args.maxHits ?? DEFAULT_MAX_HITS;
      const contextLines = args.contextLines ?? DEFAULT_CONTEXT;
      const re = compilePattern(args.pattern, args.caseSensitive ?? false);
      const globMatcher = args.glob ? compileGlob(args.glob) : null;

      const hits: GrepHit[] = [];
      let filesScanned = 0;
      let capped = false;

      const walk = (dir: string): void => {
        if (capped) return;
        let entries: import("node:fs").Dirent[];
        try {
          entries = readdirSync(dir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const entry of entries) {
          if (capped) return;
          const full = join(dir, entry.name);
          if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) continue;
            walk(full);
            continue;
          }
          if (!entry.isFile()) continue;
          const ext = extname(entry.name).toLowerCase();
          if (SKIP_EXT.has(ext)) continue;
          const rel = relative(config.cwd, full);
          if (globMatcher && !globMatcher(rel)) continue;

          let size: number;
          try {
            size = statSync(full).size;
          } catch {
            continue;
          }
          if (size > MAX_FILE_BYTES) continue;

          let text: string;
          try {
            text = readFileSync(full, "utf8");
          } catch {
            continue;
          }
          if (text.includes("\0")) continue;
          filesScanned += 1;

          const lines = text.split("\n");
          for (let i = 0; i < lines.length; i += 1) {
            const line = lines[i] ?? "";
            const matches = line.matchAll(re);
            const first = matches.next();
            if (first.done) continue;
            const m = first.value;
            hits.push({
              file: rel,
              line: i + 1,
              col: (m.index ?? 0) + 1,
              text: line,
              context: {
                before: lines.slice(Math.max(0, i - contextLines), i),
                after: lines.slice(i + 1, Math.min(lines.length, i + 1 + contextLines)),
              },
            });
            if (hits.length >= maxHits) {
              capped = true;
              break;
            }
          }
        }
      };

      walk(root);
      const data: GrepData = {
        pattern: args.pattern,
        hits,
        filesScanned,
        hitsCapped: capped,
      };
      return data;
    },
  });
}

function compilePattern(pattern: string, caseSensitive: boolean): RegExp {
  const flags = caseSensitive ? "g" : "gi";
  try {
    return new RegExp(pattern, flags);
  } catch {
    return new RegExp(escapeRegex(pattern), flags);
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Minimal glob: ** = any, * = any-non-sep, ? = single-non-sep.
 * Good enough for "src/STAR/*.ts" style filters. No brace expansion.
 */
function compileGlob(glob: string): (path: string) => boolean {
  const normalized = glob.split("/").join(sep);
  let re = "^";
  for (let i = 0; i < normalized.length; i += 1) {
    const c = normalized[i];
    if (c === "*") {
      if (normalized[i + 1] === "*") {
        re += ".*";
        i += 1;
      } else {
        re += `[^${escapeSep()}]*`;
      }
    } else if (c === "?") {
      re += `[^${escapeSep()}]`;
    } else if (c === ".") {
      re += "\\.";
    } else if (c !== undefined) {
      re += escapeRegex(c);
    }
  }
  re += "$";
  const rx = new RegExp(re);
  return (p) => rx.test(p);
}

function escapeSep(): string {
  return sep === "\\" ? "\\\\" : sep;
}
