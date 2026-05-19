import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { git } from "../src/primitives/git.ts";
import { resolveConfig } from "../src/engine/session.ts";

// Pass identity via env vars so we don't touch git config (some host
// environments install hooks that block writes to user.email).
const GIT_ENV: Record<string, string> = {
  ...process.env as Record<string, string>,
  GIT_AUTHOR_NAME: "engram test",
  GIT_AUTHOR_EMAIL: "engram-test@local",
  GIT_COMMITTER_NAME: "engram test",
  GIT_COMMITTER_EMAIL: "engram-test@local",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
};

function sh(cwd: string, argv: readonly string[]): void {
  const r = spawnSync(argv[0] ?? "", argv.slice(1), {
    cwd,
    encoding: "utf8",
    env: GIT_ENV,
  });
  if ((r.status ?? 0) !== 0) {
    throw new Error(`${argv.join(" ")} failed: ${r.stderr}`);
  }
}

function makeRepo(): { cwd: string; cleanup: () => void } {
  const cwd = mkdtempSync(join(tmpdir(), "engram-git-"));
  sh(cwd, ["git", "init", "-q", "-b", "main"]);
  writeFileSync(join(cwd, "a.txt"), "alpha\nbeta\n");
  sh(cwd, ["git", "add", "a.txt"]);
  sh(cwd, ["git", "commit", "-q", "--no-gpg-sign", "-m", "first commit"]);
  writeFileSync(join(cwd, "a.txt"), "alpha\nbeta\ngamma\n");
  sh(cwd, ["git", "add", "a.txt"]);
  sh(cwd, ["git", "commit", "-q", "--no-gpg-sign", "-m", "add gamma"]);
  return { cwd, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

test("git log returns recent commits", async () => {
  const { cwd, cleanup } = makeRepo();
  try {
    const config = resolveConfig({ cwd });
    const out = await git({ mode: "log", maxEntries: 5 }, config);
    assert.equal(out.ok, true);
    if (!out.ok || out.data.mode !== "log") return;
    assert.equal(out.data.entries.length, 2);
    const subjects = out.data.entries.map((e) => e.subject);
    assert.ok(subjects.includes("first commit"));
    assert.ok(subjects.includes("add gamma"));
  } finally {
    cleanup();
  }
});

test("git log scoped to a file", async () => {
  const { cwd, cleanup } = makeRepo();
  try {
    writeFileSync(join(cwd, "b.txt"), "other\n");
    sh(cwd, ["git", "add", "b.txt"]);
    sh(cwd, ["git", "commit", "-q", "-m", "add b"]);
    const config = resolveConfig({ cwd });
    const out = await git({ mode: "log", file: "a.txt" }, config);
    assert.equal(out.ok, true);
    if (!out.ok || out.data.mode !== "log") return;
    for (const e of out.data.entries) {
      assert.ok(e.subject !== "add b");
    }
  } finally {
    cleanup();
  }
});

test("git blame attributes lines", async () => {
  const { cwd, cleanup } = makeRepo();
  try {
    const config = resolveConfig({ cwd });
    const out = await git({ mode: "blame", file: "a.txt" }, config);
    assert.equal(out.ok, true);
    if (!out.ok || out.data.mode !== "blame") return;
    assert.equal(out.data.lines.length, 3);
    assert.equal(out.data.lines[0]?.text, "alpha");
    assert.equal(out.data.lines[2]?.text, "gamma");
    for (const line of out.data.lines) {
      assert.ok(line.sha.length === 40);
      assert.ok(line.author.length > 0);
    }
  } finally {
    cleanup();
  }
});

test("git diff at HEAD~1..HEAD", async () => {
  const { cwd, cleanup } = makeRepo();
  try {
    const config = resolveConfig({ cwd });
    const out = await git({ mode: "diff", ref: "HEAD~1" }, config);
    assert.equal(out.ok, true);
    if (!out.ok || out.data.mode !== "diff") return;
    assert.ok(out.data.diff.includes("+gamma"));
  } finally {
    cleanup();
  }
});

test("git rejects path escape from cwd", async () => {
  const { cwd, cleanup } = makeRepo();
  try {
    const config = resolveConfig({ cwd });
    const out = await git({ mode: "blame", file: "../etc/passwd" }, config);
    assert.equal(out.ok, false);
  } finally {
    cleanup();
  }
});
