/**
 * Append-only JSONL journal.
 *
 * Every primitive call lands here, in order, never edited. This is the
 * verifiability layer: you can prove what engram (and through it, Claude)
 * examined, when, and what came back.
 *
 * Format: one JSON object per line. Append-only. No fsync — we accept the
 * standard OS write-cache trade for speed; the audit chain is durable across
 * process restarts but not across power loss without explicit flush.
 *
 * Why JSONL (not SQLite) in v0:
 *   - zero native deps; works on every host
 *   - perfectly suited to append-only audit logs
 *   - tail-able with stock UNIX tools
 *   - migrating to SQLite later is a one-file change (load -> insert)
 */

import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { dirname } from "node:path";

import type { JournalEntry, PrimitiveName } from "../types.ts";

export interface JournalAppendInput {
  readonly primitive: PrimitiveName;
  readonly args: Readonly<Record<string, unknown>>;
  readonly result: unknown;
  readonly durationMs: number;
  readonly cwd: string;
  readonly sessionId: string;
  readonly callerHint?: string;
}

export interface JournalReader {
  readonly entries: () => readonly JournalEntry[];
  readonly bySession: (sessionId: string) => readonly JournalEntry[];
  readonly byPrimitive: (primitive: PrimitiveName) => readonly JournalEntry[];
  readonly count: () => number;
  readonly size: () => number;
}

const PREVIEW_LIMIT = 240;

export function hashResult(result: unknown): string {
  const json = stableStringify(result);
  return createHash("sha256").update(json).digest("hex").slice(0, 16);
}

export function previewResult(result: unknown): string {
  const json = stableStringify(result);
  if (json.length <= PREVIEW_LIMIT) {
    return json;
  }
  return `${json.slice(0, PREVIEW_LIMIT)}…(+${json.length - PREVIEW_LIMIT}B)`;
}

export function appendJournal(path: string, input: JournalAppendInput): JournalEntry {
  ensureDir(path);
  const entry: JournalEntry = {
    id: randomUUID(),
    ts: new Date().toISOString(),
    primitive: input.primitive,
    args: input.args,
    resultHash: hashResult(input.result),
    resultPreview: previewResult(input.result),
    durationMs: input.durationMs,
    cwd: input.cwd,
    sessionId: input.sessionId,
    ...(input.callerHint === undefined ? {} : { callerHint: input.callerHint }),
  };
  appendFileSync(path, `${JSON.stringify(entry)}\n`, "utf8");
  return entry;
}

export function readJournal(path: string): JournalReader {
  const loaded: JournalEntry[] = [];
  if (existsSync(path)) {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        loaded.push(JSON.parse(line) as JournalEntry);
      } catch {
        // skip corrupt lines — append-only file may have a torn last write
        continue;
      }
    }
  }
  const size = existsSync(path) ? statSync(path).size : 0;
  return {
    entries: () => loaded,
    bySession: (sid) => loaded.filter((e) => e.sessionId === sid),
    byPrimitive: (p) => loaded.filter((e) => e.primitive === p),
    count: () => loaded.length,
    size: () => size,
  };
}

function ensureDir(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Deterministic stringify so the same logical result always hashes the same.
 * Sorts object keys; arrays preserve order (they're semantically ordered).
 */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val: unknown) => {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const obj = val as Record<string, unknown>;
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(obj).sort()) {
        sorted[k] = obj[k];
      }
      return sorted;
    }
    return val;
  });
}
