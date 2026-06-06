# Primitive reference

## Overview

The five primitives are the entire surface engram exposes. Every one is bounded, journaled, and returns structured JSON. The runner is the only component that touches the journal — no primitive can bypass the audit chain.

```
grep ──┐
read ──┤
ast  ──┤── run() ──── append ──── .engram/journal.jsonl
git  ──┤
recurse┘
```

---

## grep — bounded text search

**Signature:** `grep(pattern, [path], [glob], [maxHits], [contextLines], [caseSensitive])`

**CLI:** `engram grep <pattern> [--path P] [--glob G] [--max N] [--ctx N] [--case]`

**Implementation:** `src/primitives/grep.ts`

Recursively walks a directory using `readdirSync`, reads text files with `readFileSync`, and tests lines against a `RegExp`. Skips `node_modules`, `.git`, `dist`, `build`, `.next`, `.nuxt`, `.turbo`, `.vercel`, `.cache`, `coverage`, and `.engram`. Also skips binary extensions (images, archives, audio, video, lockfiles, `.wasm`).

**Bounds:**

| Parameter | Default | Cap |
|-----------|---------|-----|
| maxHits | 50 | Hard cap — stops scanning after N hits |
| contextLines | 2 | Lines before/after each hit |
| File size | — | Files > 2MB are skipped silently |
| Binary detection | — | Files containing `\0` are skipped |

**Output:**
```json
{
  "pattern": "TODO",
  "hits": [
    { "file": "src/primitives/grep.ts", "line": 1, "col": 3, "text": "/* TODO */", "context": { "before": [], "after": [] } }
  ],
  "filesScanned": 42,
  "hitsCapped": false
}
```

**Notes:**

- If `pattern` is not a valid regex, it is escaped and matched as a literal string.
- Glob matching supports `**` (any depth), `*` (single-segment), `?` (single char). No brace expansion.
- Purely synchronous — does not block the event loop for concurrent I/O, but the walk is fast enough for repo-scale searches.

---

## read — file slice

**Signature:** `read(file, fromLine, toLine)`

**CLI:** `engram read <file> <fromLine> <toLine>`

**Implementation:** `src/primitives/read.ts`

Returns a 1-indexed, inclusive line range from a file. Never returns the whole file — the range is hard-capped at 400 lines per call.

**Bounds:**

| Parameter | Cap |
|-----------|-----|
| Line range | ≤ 400 lines per call |
| fromLine | Must be ≥ 1 |
| toLine | Must be ≥ fromLine |

**Output:**
```json
{
  "file": "src/engine/runner.ts",
  "fromLine": 31,
  "toLine": 78,
  "totalLines": 124,
  "lines": ["export async function run<T>(...)", "..."]
}
```

**Notes:**

- If the requested range exceeds the file length, it silently clamps to the file bounds.
- Errors on: invalid range, non-existent file, path that resolves outside cwd.

---

## ast — structural queries

**Signature:** `ast(file, query)`

**CLI:** `engram ast <file> <query>`

**Implementation:** `src/primitives/ast.ts`

Uses the TypeScript compiler API (`createSourceFile`) to analyze a single file. No type-checking, no tsconfig discovery, no `node_modules` traversal — pure syntactic analysis over the file text.

**Supported queries:**

| Query kind | Returns |
|-----------|---------|
| `functions` | Top-level functions, arrow-const variables, methods |
| `classes` | Classes, interfaces, type aliases |
| `exports` | All exported names (named, default, re-exports) |
| `imports` | All import bindings (default, named, namespace, side-effect) |
| `symbol-at` | Tightest enclosing symbol at a given (line, col) |

**Bounds:**

| Parameter | Cap |
|-----------|-----|
| Symbols returned | ≤ 200 per query |

**Output:**
```json
{
  "file": "src/engine/runner.ts",
  "query": { "kind": "functions" },
  "symbols": [
    { "name": "run", "kind": "function", "line": 31, "endLine": 78, "signature": "export async function run<T>(...)", "exported": true }
  ]
}
```

**Supported extensions:**

`.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.jsx`, `.mjs`, `.cjs`

**Notes:**

- `symbol-at` returns at most 1 symbol (the most nested one at the position).
- Function signatures are truncated at 200 characters if they exceed the limit.

---

## git — bounded history views

**Signature:** `git(mode, [file], [since], [maxEntries], [ref])`

**CLI:** `engram git log|blame|diff [--file F] [--since S] [--max N] [--ref R]`

**Implementation:** `src/primitives/git.ts`

All modes use `spawnSync("git", argv, ...)` with a fixed `argv` array — no shell. Arguments pass directly as git arguments.

### log

Returns recent commits for the repo or a specific file.

**Bounds:** 30 commits max by default.

**Output:**
```json
{
  "mode": "log",
  "entries": [
    { "sha": "a1b2c3d...", "author": "Manav Arya Singh", "date": "2026-06-01T12:00:00Z", "subject": "feat: add grep primitive" }
  ]
}
```

### blame

Returns per-line authorship for a file using `git blame --porcelain`.

**Bounds:** 400 lines max.

**Output:**
```json
{
  "mode": "blame",
  "file": "src/index.ts",
  "lines": [
    { "line": 1, "sha": "a1b2c3d...", "author": "Manav Arya Singh", "date": "2026-06-01T12:00:00Z", "text": "export { grep } from './primitives/grep.ts';" }
  ]
}
```

### diff

Returns the diff for a ref (default: `HEAD`), optionally filtered to a file.

**Bounds:** 32KB diff output cap.

**Output:**
```json
{
  "mode": "diff",
  "ref": "HEAD~1",
  "file": "src/index.ts",
  "diff": "diff --git a/src/index.ts b/src/index.ts\n..."
}
```

**Path safety:** `resolveFile()` rejects paths that resolve outside `cwd`, preventing path traversal.

---

## recurse — delegation directive

**Signature:** `recurse(prompt, snippets, [maxTokens])`

**CLI:** `engram recurse <promptFile> <snippetsJsonFile>`

**Implementation:** `src/primitives/recurse.ts`

The RLM core. Validates that the current depth is within bounds, then emits a structured delegation request. The parent Claude (running `/engram`) is expected to dispatch this via the Task tool and feed only the sub-agent's 1-3 sentence conclusion back into context.

**Bounds:**

| Parameter | Cap |
|-----------|-----|
| Max depth | 4 (configurable) |
| Max snippets | 16 per call |
| Total snippet bytes | 24KB |
| Prompt length | 2000 chars |

**Output:**
```json
{
  "prompt": "Analyze the auth flow",
  "conclusion": "ENGRAM-RECURSE-REQUEST id=... depth=1/4\n\nDispatch this via the Task subagent...",
  "snippetCount": 3,
  "recurseId": "uuid-string",
  "mode": "delegation-request"
}
```

**Notes:**

- If `ENGRAM_RECURSE_DEPTH` env var is set, it is checked and incremented to prevent infinite descent.
- The primitive does not execute the sub-agent — it only validates and emits the request. Execution is the parent's responsibility.
