# Performance

## Design philosophy

engram's performance target is **interactive latency for a REPL**, not batch throughput. Each primitive call should complete fast enough that Claude can issue 3-10 calls in a conversational turn. The demo in README shows a 3-call traversal completing in 12ms.

The key insight: bounded outputs mean bounded runtime. No primitive scans more files, reads more lines, or returns more bytes than its cap allows. This makes latency predictable regardless of repo size.

## Primitive benchmarks

Measured against the engram repo itself (~2K LOC, ~20 source files). Hardware: M-series MacBook.

| Primitive | Typical call | Latency | Notes |
|-----------|-------------|---------|-------|
| grep | `grep "TODO" --glob "src/**/*.ts"` | 3-8ms | Walks fs with `readdirSync`; caps at 50 hits |
| read | `read src/engine/runner.ts 31 78` | <1ms | `readFileSync` + slice, hard-capped 400 lines |
| ast | `ast src/primitives/ast.ts functions` | 2-5ms | `createSourceFile` only, no type-checking |
| git log | `git log --max 30` | 2-10ms | `spawnSync` git, parsed from `--pretty=format` |
| git blame | `git blame --file src/index.ts` | 5-30ms | Parses `--porcelain` output, capped at 400 lines |
| recurse | validate + emit delegation directive | <1ms | No subprocess — pure JS validation + string assembly |

## Byte budgets

All primitive outputs flow through `enforceBudget()` in `src/engine/runner.ts`. The default budget is **64KB** per call. When exceeded:

- Arrays (hit lists, symbol lists, log entries) are truncated proportionally
- Long strings are truncated at 4096 chars with a `(+NB)` suffix
- The caller receives `truncated: true`

This prevents a single fat result from bloating the parent Claude's context window.

## Why `readdirSync` instead of ripgrep for grep

The grep primitive uses pure `readdirSync` + `readFileSync` + `RegExp.test()` rather than spawning ripgrep. This decision is explicit:

- **Zero dependency** — engram ships with one npm package (TypeScript) and grep adds no runtime deps
- **Sufficient for coding-agent use** — most searches are narrow (glob-filtered, within `src/`)
- **Cross-platform without binaries** — ripgrep requires a native binary per platform

If benchmarks against 100K+ LOC repos show grep as a bottleneck, a ripgrep backend can be added in v0.1 as an opt-in.

## Why `spawnSync` instead of `exec` for git

`spawnSync` with a fixed `argv` array is used instead of `exec`:

| | `exec` | `spawnSync` (chosen) |
|---|---|---|
| Shell involvement | Yes — risk of command injection | No — fixed argv |
| Max buffer | Configurable but implicit | Explicit `maxBuffer: 8MB` |
| Argument safety | String interpolation needed | Array avoids escaping issues |

## Large-repo behavior

engram's primitives are bounded by design, so repo size affects only the **first** grep scan (which walks the directory tree). Subsequent calls are constant-time for `read`, `ast`, and `git` primitives.

For a 40K LOC repo with 120 source files (the `designlang` benchmark in README):

- `grep "class" --max 8` — ~122ms (full walk)
- `grep "class" --glob "src/auth/**/*.ts" --max 8` — ~3ms (narrow glob)

The 2MB/file cap in grep means binary files and generated bundles are silently skipped.

## Journal overhead

Each journal entry is roughly 200-600 bytes on disk. A 10-call session adds ~3-6KB. The journal uses `appendFileSync` without explicit `fsync` — the standard OS write cache trade for speed. The audit chain is durable across process restarts but not across power loss.

## v0.1 perf targets

- Ripgrep backend for grep (configurable, off by default)
- Tree-sitter polyglot AST (higher upfront parse cost, but no TypeScript dep)
- Optional SQLite journal (faster query for large sessions)
