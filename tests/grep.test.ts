import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { grep } from "../src/primitives/grep.ts";
import { resolveConfig } from "../src/engine/session.ts";

function makeRepo(): { cwd: string; cleanup: () => void } {
  const cwd = mkdtempSync(join(tmpdir(), "engram-grep-"));
  mkdirSync(join(cwd, "src"));
  mkdirSync(join(cwd, "node_modules"));
  writeFileSync(join(cwd, "src", "a.ts"), "function alpha() {\n  return 1;\n}\n");
  writeFileSync(join(cwd, "src", "b.ts"), "function beta() {\n  return 2;\n}\nexport const ALPHA = 'a';\n");
  writeFileSync(join(cwd, "node_modules", "skip.ts"), "function alpha() {}\n");
  return { cwd, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

test("grep finds a symbol and reports file:line:col with context", async () => {
  const { cwd, cleanup } = makeRepo();
  try {
    const config = resolveConfig({ cwd });
    const out = await grep({ pattern: "alpha", caseSensitive: true }, config);
    assert.equal(out.ok, true);
    if (!out.ok) return;
    const hits = out.data.hits;
    assert.ok(hits.length >= 1);
    const a = hits.find((h) => h.file.endsWith("a.ts"));
    assert.ok(a, "should find hit in a.ts");
    assert.equal(a?.line, 1);
    assert.ok(a?.col >= 1);
  } finally {
    cleanup();
  }
});

test("grep skips node_modules by default", async () => {
  const { cwd, cleanup } = makeRepo();
  try {
    const config = resolveConfig({ cwd });
    const out = await grep({ pattern: "alpha", caseSensitive: true }, config);
    assert.equal(out.ok, true);
    if (!out.ok) return;
    for (const h of out.data.hits) {
      assert.ok(!h.file.includes("node_modules"));
    }
  } finally {
    cleanup();
  }
});

test("grep is case-insensitive by default", async () => {
  const { cwd, cleanup } = makeRepo();
  try {
    const config = resolveConfig({ cwd });
    const out = await grep({ pattern: "ALPHA" }, config);
    assert.equal(out.ok, true);
    if (!out.ok) return;
    // hits include both lowercase `alpha` and uppercase `ALPHA`
    assert.ok(out.data.hits.some((h) => h.text.includes("alpha")));
    assert.ok(out.data.hits.some((h) => h.text.includes("ALPHA")));
  } finally {
    cleanup();
  }
});

test("grep honors glob filter", async () => {
  const { cwd, cleanup } = makeRepo();
  try {
    const config = resolveConfig({ cwd });
    const out = await grep({ pattern: "function", glob: "src/**/a.ts" }, config);
    assert.equal(out.ok, true);
    if (!out.ok) return;
    for (const h of out.data.hits) {
      assert.ok(h.file.endsWith("a.ts"));
    }
  } finally {
    cleanup();
  }
});

test("grep caps results and reports hitsCapped", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "engram-grep-cap-"));
  try {
    let big = "";
    for (let i = 0; i < 100; i += 1) {
      big += "needle here\n";
    }
    writeFileSync(join(cwd, "big.txt"), big);
    const config = resolveConfig({ cwd });
    const out = await grep({ pattern: "needle", maxHits: 10 }, config);
    assert.equal(out.ok, true);
    if (!out.ok) return;
    assert.equal(out.data.hits.length, 10);
    assert.equal(out.data.hitsCapped, true);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("grep treats invalid regex as literal", async () => {
  const { cwd, cleanup } = makeRepo();
  try {
    const config = resolveConfig({ cwd });
    const out = await grep({ pattern: "alpha(" }, config);
    // unbalanced paren becomes literal — should not throw
    assert.equal(out.ok, true);
  } finally {
    cleanup();
  }
});
