# Contributing

## Prerequisites

- Node >= 22.6 (uses `--experimental-strip-types` — no build step)
- `npm` (comes with Node)

## Setup

```bash
git clone https://github.com/Manavarya09/engram
cd engram
npm install
```

## Development

engram ships its TypeScript source directly — there is no `dist/`, no build step, no `tsc` emit. Type-checking is separate:

```bash
npm run typecheck   # tsc --noEmit
npm test            # node --test --experimental-strip-types tests/*.test.ts
```

Run a primitive directly:

```bash
node --experimental-strip-types src/cli.ts grep "TODO" --glob "src/**/*.ts"
```

## Project layout

```
src/
  cli.ts                  argv → primitive dispatch
  types.ts                every public contract
  index.ts                programmatic re-exports
  engine/
    journal.ts            append-only JSONL audit chain
    session.ts            env-aware config bootstrap
    runner.ts             byte budget + journal wrapper
  primitives/
    grep.ts               bounded text search
    read.ts               file slice (≤400 lines)
    ast.ts                TS compiler API queries
    git.ts                log/blame/diff via spawnSync
    recurse.ts            delegation directive emitter
tests/                    node:test, hermetic
docs/
  ARCHITECTURE.md         design contracts + threat model
  PRIMITIVES.md           primitive reference
  PERFORMANCE.md          performance characteristics
  COMPARISON.md           comparison with other tools
  SECURITY.md             security model
  paper/engram.md         research paper
```

## Design constraints

1. **No whole-file returns.** Every primitive output is bounded — byte-budgeted, count-capped, or slice-only. Truncation is a signal (`truncated: true`), not silent data loss.

2. **No shell commands.** All subprocess calls use `spawnSync(cmd, argv, ...)` with a fixed argv. No shell, no string interpolation into command lines.

3. **No path escape.** File paths are resolved against `cwd` and rejected if they resolve outside it.

4. **The journal is the source of truth.** Every primitive call appends to `.engram/journal.jsonl` — sha256-hashed, append-only, replayable. No path skips the runner.

5. **Zero extra dependencies beyond TypeScript.** No database, no vector store, no HTTP server. engram ships with one npm dependency (TypeScript) and one only because the AST primitive needs the compiler API.

## Adding a primitive

1. Create `src/primitives/<name>.ts` — implement the logic, call `run()` from `src/engine/runner.ts` for journaling.
2. Add args + result types in `src/types.ts`.
3. Wire the CLI dispatch in `src/cli.ts`.
4. Re-export from `src/index.ts`.
5. Add tests in `tests/<name>.test.ts`.
6. Document in `docs/PRIMITIVES.md`.

## Testing

Tests use Node's built-in `node:test` and `node:assert` — no test framework dependency. Run them:

```bash
npm test
```

Tests are hermetic: they operate on fixture files or mock the filesystem. Git tests use `git init` in a temp directory.

## Commit conventions

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add <primitive/feature>
fix: correct <bug>
docs: update <documentation>
refactor: restructure <area> without behavior change
test: add <test coverage>
chore: <tooling, deps, CI>
```

## Before submitting a PR

- `npm run typecheck` passes
- `npm test` passes
- `git diff --stat` shows only lines that trace to your change (no unrelated cleanup)
