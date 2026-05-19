import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { recurse } from "../src/primitives/recurse.ts";
import { resolveConfig } from "../src/engine/session.ts";

function tempCwd(): { cwd: string; cleanup: () => void } {
  const cwd = mkdtempSync(join(tmpdir(), "engram-recurse-"));
  return { cwd, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

test("recurse emits a delegation-request with id + depth", async () => {
  const { cwd, cleanup } = tempCwd();
  try {
    const config = resolveConfig({ cwd });
    const out = await recurse(
      {
        prompt: "summarize the auth flow",
        snippets: [{ source: "src/auth.ts:1-40", content: "function login() {}" }],
      },
      config,
    );
    assert.equal(out.ok, true);
    if (!out.ok) return;
    assert.equal(out.data.mode, "delegation-request");
    assert.equal(out.data.snippetCount, 1);
    assert.ok(out.data.recurseId.length > 0);
    assert.ok(out.data.conclusion.includes("ENGRAM-RECURSE-REQUEST"));
    assert.ok(out.data.conclusion.includes("Dispatch this via the Task subagent tool"));
  } finally {
    cleanup();
  }
});

test("recurse refuses empty prompt", async () => {
  const { cwd, cleanup } = tempCwd();
  try {
    const config = resolveConfig({ cwd });
    const out = await recurse(
      { prompt: "", snippets: [{ source: "x", content: "y" }] },
      config,
    );
    assert.equal(out.ok, false);
  } finally {
    cleanup();
  }
});

test("recurse refuses zero snippets", async () => {
  const { cwd, cleanup } = tempCwd();
  try {
    const config = resolveConfig({ cwd });
    const out = await recurse({ prompt: "do it", snippets: [] }, config);
    assert.equal(out.ok, false);
  } finally {
    cleanup();
  }
});

test("recurse enforces depth cap", async () => {
  const { cwd, cleanup } = tempCwd();
  try {
    const config = resolveConfig({ cwd, recurseDepth: 4, maxRecurseDepth: 4 });
    const out = await recurse(
      { prompt: "deeper", snippets: [{ source: "a", content: "b" }] },
      config,
    );
    assert.equal(out.ok, false);
    if (out.ok) return;
    assert.ok(out.error.includes("depth"));
  } finally {
    cleanup();
  }
});

test("recurse enforces snippet byte budget", async () => {
  const { cwd, cleanup } = tempCwd();
  try {
    const config = resolveConfig({ cwd });
    const huge = "x".repeat(30 * 1024);
    const out = await recurse(
      { prompt: "p", snippets: [{ source: "big", content: huge }] },
      config,
    );
    assert.equal(out.ok, false);
  } finally {
    cleanup();
  }
});

test("recurse caps snippet count", async () => {
  const { cwd, cleanup } = tempCwd();
  try {
    const config = resolveConfig({ cwd });
    const many = Array.from({ length: 20 }, (_, i) => ({
      source: `s${i}`,
      content: "x",
    }));
    const out = await recurse({ prompt: "p", snippets: many }, config);
    assert.equal(out.ok, false);
  } finally {
    cleanup();
  }
});
