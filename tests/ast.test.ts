import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ast } from "../src/primitives/ast.ts";
import { resolveConfig } from "../src/engine/session.ts";

function withFile(name: string, content: string): { cwd: string; cleanup: () => void } {
  const cwd = mkdtempSync(join(tmpdir(), "engram-ast-"));
  writeFileSync(join(cwd, name), content);
  return { cwd, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

test("ast functions finds declarations, methods, and arrow consts", async () => {
  const code = `
export function alpha() { return 1; }
function beta() { return 2; }
export const gamma = (x: number) => x * 2;
class Foo { delta() {} }
`.trim();
  const { cwd, cleanup } = withFile("f.ts", code);
  try {
    const config = resolveConfig({ cwd });
    const out = await ast({ file: "f.ts", query: { kind: "functions" } }, config);
    assert.equal(out.ok, true);
    if (!out.ok) return;
    const names = out.data.symbols.map((s) => s.name);
    assert.ok(names.includes("alpha"));
    assert.ok(names.includes("beta"));
    assert.ok(names.includes("gamma"));
    assert.ok(names.includes("delta"));
    const alpha = out.data.symbols.find((s) => s.name === "alpha");
    assert.equal(alpha?.exported, true);
    const beta = out.data.symbols.find((s) => s.name === "beta");
    assert.equal(beta?.exported, false);
  } finally {
    cleanup();
  }
});

test("ast classes finds classes, interfaces, types", async () => {
  const code = `
export class Foo { a() {} }
interface Bar { x: number }
type Baz = string | number;
`.trim();
  const { cwd, cleanup } = withFile("f.ts", code);
  try {
    const config = resolveConfig({ cwd });
    const out = await ast({ file: "f.ts", query: { kind: "classes" } }, config);
    assert.equal(out.ok, true);
    if (!out.ok) return;
    const kinds = new Map(out.data.symbols.map((s) => [s.name, s.kind]));
    assert.equal(kinds.get("Foo"), "class");
    assert.equal(kinds.get("Bar"), "interface");
    assert.equal(kinds.get("Baz"), "type");
  } finally {
    cleanup();
  }
});

test("ast exports finds named, default, and prefixed exports", async () => {
  const code = `
export const a = 1;
export function b() {}
const c = 3;
export { c };
export default 42;
`.trim();
  const { cwd, cleanup } = withFile("f.ts", code);
  try {
    const config = resolveConfig({ cwd });
    const out = await ast({ file: "f.ts", query: { kind: "exports" } }, config);
    assert.equal(out.ok, true);
    if (!out.ok) return;
    const names = out.data.symbols.map((s) => s.name);
    assert.ok(names.includes("a"));
    assert.ok(names.includes("b"));
    assert.ok(names.includes("c"));
    assert.ok(names.includes("default"));
  } finally {
    cleanup();
  }
});

test("ast imports records default + named + namespace", async () => {
  const code = `
import alpha from "./alpha.ts";
import { beta, gamma } from "./pack.ts";
import * as utils from "./utils.ts";
import "./side-effect.ts";
`.trim();
  const { cwd, cleanup } = withFile("f.ts", code);
  try {
    const config = resolveConfig({ cwd });
    const out = await ast({ file: "f.ts", query: { kind: "imports" } }, config);
    assert.equal(out.ok, true);
    if (!out.ok) return;
    const joined = out.data.symbols.map((s) => s.name).join("|");
    assert.ok(joined.includes("alpha"));
    assert.ok(joined.includes("beta"));
    assert.ok(joined.includes("gamma"));
    assert.ok(joined.includes("utils"));
    assert.ok(joined.includes("side-effect"));
  } finally {
    cleanup();
  }
});

test("ast symbol-at returns the tightest matching node", async () => {
  const code = `function alpha() {\n  const x = 1;\n  return x;\n}`;
  const { cwd, cleanup } = withFile("f.ts", code);
  try {
    const config = resolveConfig({ cwd });
    const out = await ast(
      { file: "f.ts", query: { kind: "symbol-at", line: 2, col: 9 } },
      config,
    );
    assert.equal(out.ok, true);
    if (!out.ok) return;
    assert.equal(out.data.symbols.length, 1);
    assert.equal(out.data.symbols[0]?.name, "x");
  } finally {
    cleanup();
  }
});

test("ast handles .tsx files", async () => {
  const code = `export const C = () => <div>hi</div>;`;
  const { cwd, cleanup } = withFile("f.tsx", code);
  try {
    const config = resolveConfig({ cwd });
    const out = await ast({ file: "f.tsx", query: { kind: "functions" } }, config);
    assert.equal(out.ok, true);
    if (!out.ok) return;
    assert.ok(out.data.symbols.some((s) => s.name === "C"));
  } finally {
    cleanup();
  }
});
