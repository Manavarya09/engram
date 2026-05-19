# engram architecture

## The thesis in one sentence

Long context belongs in the **environment**, not in the model — and the
model gets a REPL of **coding-native** primitives to navigate it, with
every move logged to an **append-only journal** so the system's memory is
**provable**.

This is the December 2025 Recursive Language Model paradigm
([Zhang, Kraska, Khattab 2025](https://arxiv.org/abs/2512.24601))
applied to coding agents.

## The four design contracts

These are non-negotiable. Every line of engram is bound by them.

### 1. The model never bulk-loads
No primitive returns a whole file. No primitive returns "all matches."
Outputs are **byte-budgeted**, **count-capped**, and **slice-only**.
Truncation is a **signal** the model receives (`truncated: true`,
`hitsCapped: true`), not silent loss.

### 2. The journal is the source of truth
Every primitive call appends a single JSONL line to
`.engram/journal.jsonl` containing: timestamp, primitive, args, sha256
hash of the result, bounded preview, duration, session id. The journal
is **append-only**, **local-only**, **deterministic** (key-order-stable
hashing). You can replay any past session's reasoning chain.

### 3. The parent owns the plan
engram never decides what to look at — the parent Claude does. The
primitives are mechanical tools; the strategy ("grep first, then ast,
then read") lives in the `/engram` command's instructions, not in code.
This keeps engram model-agnostic and the model in the loop.

### 4. Recursion is bounded
`recurse` is depth-capped (default 4), snippet-count-capped (16), and
byte-capped (24KB). The "Recursive" in RLM is structural, not infinite.

## The five primitives

```
                ┌──────────────────────┐
                │  PrimitiveOutput<T>  │
                │  { ok, data,         │
                │    truncated, bytes, │
                │    durationMs,       │
                │    journalId }       │
                └──────────▲───────────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
   grep ──▶ │              │              │
   read ──▶ │  run() ──────┴───── append  │ ───▶ .engram/journal.jsonl
   ast  ──▶ │              │              │
   git  ──▶ │              │              │
   recurse▶ │              │              │
            └──────────────┴──────────────┘
                           │
                  byte-budget enforcement
                  (truncate, signal)
```

Every primitive funnels through `run()` in `src/engine/runner.ts`. The
runner is the only place that touches the journal. This guarantees:

- **No path skips the audit chain.**
- **Byte budgets are enforced uniformly.**
- **Errors are journaled too** (so silent failure is impossible).

## The 8-tier memory hierarchy (v0.5+ vision)

v0 implements only L0–L2 and the L4 "code graph as environment" view.
The full hierarchy:

| Tier | Name              | What lives here                                | Lifetime         | v0   |
|------|-------------------|------------------------------------------------|------------------|------|
| L0   | Active window     | Current turn's tokens                          | 1 turn           | ✓    |
| L1   | Conversation buffer | Recent turns                                  | Until compact    | n/a  |
| L2   | Session journal   | Every primitive call (decisions, hypotheses)   | Until session end | **✓** |
| L3   | Project state     | Pending TODOs, branch context, last intent     | Cross-session    | v0.5 |
| L4   | Repo knowledge    | Code graph (engram exposes this as primitives) | Indefinite       | **✓** |
| L5   | Org memory        | Patterns across all your repos                 | Indefinite       | v1.0 |
| L6   | Tool log          | Test outputs, builds, errors                   | Time-bounded     | v0.5 |
| L7   | Decision lineage  | Why X over Y, what was tried                   | Indefinite       | v0.5 |

The competitive landscape today (Mem0, Letta, Zep, Cursor index) owns at
most L4 — and even there, none expose coding-native primitives. Five of
the eight tiers are unowned. engram aims at all of them.

## Layout

```
engram/
├── .claude-plugin/
│   ├── plugin.json         — Claude Code plugin manifest
│   └── marketplace.json    — listing metadata
├── commands/
│   └── engram.md           — the /engram slash command (the playbook)
├── hooks/
│   └── hooks.json          — PreToolUse hook (v0.1 will use it)
├── src/
│   ├── types.ts            — every public contract
│   ├── index.ts            — programmatic re-exports
│   ├── cli.ts              — argv → primitive dispatch
│   ├── engine/
│   │   ├── journal.ts      — append-only JSONL audit chain
│   │   ├── session.ts      — env-aware EngramConfig
│   │   └── runner.ts       — byte budget + journal wrapper
│   └── primitives/
│       ├── grep.ts         — text search with bounded context
│       ├── read.ts         — file slice (≤400 lines)
│       ├── ast.ts          — TS compiler API queries
│       ├── git.ts          — log / blame / diff via spawnSync
│       └── recurse.ts      — delegation directive emitter
├── tests/                  — node:test, 34 tests, hermetic
├── docs/
│   ├── ARCHITECTURE.md     — this file
│   └── paper/engram.md     — the research paper
├── package.json            — Node 22.6+, ships .ts directly
├── tsconfig.json           — strict, noEmit, .ts imports
└── README.md
```

## Why we don't build with `tsc`

engram targets Node 22.6+ specifically so we can run `.ts` source directly
via `--experimental-strip-types`. There is no `dist/`. There is no build
step. The shipped artifact is the source itself. `tsc --noEmit` is
type-check only.

This makes the engram repo easier to fork, audit, and modify — qualities
that matter when your plugin's value proposition is *verifiability*.

## Threat model

engram runs locally and produces a local audit log. The threats we
defend against:

- **Command injection** via primitive args → all subprocess calls use
  `spawnSync(cmd, argv, ...)` with a fixed argv (no shell). git args are
  ref/file/since strings that pass straight to git without interpretation.
- **Path escape** from cwd → the git primitive's `resolveFile()` refuses
  any resolved path that doesn't start with the configured cwd. The read
  primitive uses `path.resolve(cwd, file)` and statSync's natural EACCES.
- **Unbounded resource use** → byte budgets, hit caps, file-size caps,
  recurse depth/count/byte caps. The runner is the choke point.
- **Audit-log tampering** → JSONL is append-only and the result hash is
  sha256 over key-sorted JSON, so any post-hoc edit shows up as a
  mismatch when the journal is replayed.

The threats we do **not** address in v0:

- A malicious Claude that *chooses not* to use engram and reads files
  directly via Claude Code's built-in tools. The `/engram` command's
  instructions ask the model to honor the contract; verification of
  honor is a v0.5 problem (the hook in `hooks/hooks.json` is the seam).
- A malicious local user with read access to `.engram/journal.jsonl`.
  The journal is meant to be private to the user; treat it like git
  history — sensitive, local-only.

## What this is, and what it isn't

engram is **not** a memory product in the Mem0/Letta sense. It is a
**REPL** for coding agents that happens to journal its calls. The memory
hierarchy is the road we're walking; the REPL is the first paving stone.

If you came expecting a vector store, you'll be disappointed. If you
came expecting Claude to never `/compact` again because *it didn't need
to load the repo in the first place*, you came to the right place.
