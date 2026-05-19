import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { read } from "../src/primitives/read.ts";
import { resolveConfig } from "../src/engine/session.ts";

function makeFile(content: string): { cwd: string; cleanup: () => void } {
  const cwd = mkdtempSync(join(tmpdir(), "engram-read-"));
  writeFileSync(join(cwd, "f.txt"), content);
  return { cwd, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

test("read returns the exact requested slice", async () => {
  const lines = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join("\n");
  const { cwd, cleanup } = makeFile(lines);
  try {
    const config = resolveConfig({ cwd });
    const out = await read({ file: "f.txt", fromLine: 5, toLine: 8 }, config);
    assert.equal(out.ok, true);
    if (!out.ok) return;
    assert.deepEqual(out.data.lines, ["line 5", "line 6", "line 7", "line 8"]);
    assert.equal(out.data.totalLines, 20);
  } finally {
    cleanup();
  }
});

test("read rejects inverted range", async () => {
  const { cwd, cleanup } = makeFile("a\nb\nc\n");
  try {
    const config = resolveConfig({ cwd });
    const out = await read({ file: "f.txt", fromLine: 5, toLine: 2 }, config);
    assert.equal(out.ok, false);
  } finally {
    cleanup();
  }
});

test("read rejects oversized range", async () => {
  const content = Array.from({ length: 1000 }, () => "x").join("\n");
  const { cwd, cleanup } = makeFile(content);
  try {
    const config = resolveConfig({ cwd });
    const out = await read({ file: "f.txt", fromLine: 1, toLine: 800 }, config);
    assert.equal(out.ok, false);
  } finally {
    cleanup();
  }
});

test("read clamps toLine past EOF without throwing", async () => {
  const { cwd, cleanup } = makeFile("a\nb\nc");
  try {
    const config = resolveConfig({ cwd });
    const out = await read({ file: "f.txt", fromLine: 1, toLine: 100 }, config);
    assert.equal(out.ok, true);
    if (!out.ok) return;
    assert.equal(out.data.lines.length, 3);
  } finally {
    cleanup();
  }
});

test("read errors on missing file via runner", async () => {
  const { cwd, cleanup } = makeFile("a\n");
  try {
    const config = resolveConfig({ cwd });
    const out = await read({ file: "nope.txt", fromLine: 1, toLine: 1 }, config);
    assert.equal(out.ok, false);
  } finally {
    cleanup();
  }
});
