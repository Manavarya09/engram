import { test } from "node:test";
import assert from "node:assert/strict";
import { appendFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { appendJournal, readJournal, hashResult, previewResult } from "../src/engine/journal.ts";

function withTempJournal<T>(fn: (path: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "engram-journal-"));
  const path = join(dir, "journal.jsonl");
  try {
    return fn(path);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("appendJournal writes a single JSONL line per call", () => {
  withTempJournal((path) => {
    const e1 = appendJournal(path, {
      primitive: "grep",
      args: { pattern: "foo" },
      result: { hits: [] },
      durationMs: 5,
      cwd: "/repo",
      sessionId: "s1",
    });
    const e2 = appendJournal(path, {
      primitive: "read",
      args: { file: "a.ts", fromLine: 1, toLine: 5 },
      result: { lines: ["x"] },
      durationMs: 1,
      cwd: "/repo",
      sessionId: "s1",
    });

    const reader = readJournal(path);
    assert.equal(reader.count(), 2);
    const all = reader.entries();
    assert.equal(all[0]?.id, e1.id);
    assert.equal(all[1]?.id, e2.id);
    assert.equal(all[0]?.primitive, "grep");
    assert.equal(all[1]?.primitive, "read");
  });
});

test("readJournal indexes by session and primitive", () => {
  withTempJournal((path) => {
    appendJournal(path, { primitive: "grep", args: {}, result: 1, durationMs: 0, cwd: "/r", sessionId: "A" });
    appendJournal(path, { primitive: "read", args: {}, result: 2, durationMs: 0, cwd: "/r", sessionId: "A" });
    appendJournal(path, { primitive: "grep", args: {}, result: 3, durationMs: 0, cwd: "/r", sessionId: "B" });

    const reader = readJournal(path);
    assert.equal(reader.bySession("A").length, 2);
    assert.equal(reader.bySession("B").length, 1);
    assert.equal(reader.byPrimitive("grep").length, 2);
    assert.equal(reader.byPrimitive("read").length, 1);
  });
});

test("hashResult is deterministic and key-order-independent", () => {
  const a = hashResult({ x: 1, y: 2 });
  const b = hashResult({ y: 2, x: 1 });
  assert.equal(a, b);
  const c = hashResult({ x: 1, y: 3 });
  assert.notEqual(a, c);
});

test("previewResult truncates with a clear marker", () => {
  const big = "x".repeat(1000);
  const p = previewResult({ data: big });
  assert.ok(p.includes("…"));
  assert.ok(p.includes("+"));
});

test("readJournal survives corrupt trailing line", () => {
  withTempJournal((path) => {
    appendJournal(path, { primitive: "grep", args: {}, result: 1, durationMs: 0, cwd: "/r", sessionId: "s" });
    // append a torn line manually
    appendFileSync(path, "{not json\n", "utf8");
    appendJournal(path, { primitive: "read", args: {}, result: 2, durationMs: 0, cwd: "/r", sessionId: "s" });

    const reader = readJournal(path);
    assert.equal(reader.count(), 2);
  });
});

test("readJournal returns empty when file does not exist", () => {
  const reader = readJournal("/tmp/engram-nonexistent-path-xyz.jsonl");
  assert.equal(reader.count(), 0);
  assert.equal(reader.size(), 0);
});
