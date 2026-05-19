# engram

> **The first Recursive Language Model engine for Claude Code.**
> The codebase is never loaded into context — Claude examines it via a logged REPL of five coding-native primitives.
> Verifiable. Local-first. Infinite-feeling context.

```
┌─────────────────────────────────────────────────────────────────┐
│  USER PROMPT                                                    │
│    v                                                            │
│  Claude (parent) -- sees ONLY the prompt + 5-primitive tools.   │
│  The codebase is NOT in the context window.                     │
│    v programmatically calls                                     │
│  engram REPL                                                    │
│    |- grep     bounded text search, file:line:col + context     │
│    |- read     file slice (never full files, <= 400 lines)      │
│    |- ast      TS compiler API: functions, classes, exports     │
│    |- git      log / blame / diff, bounded                      │
│    |_ recurse  delegate dense snippet to a Task subagent        │
│    v every call appended to                                     │
│  .engram/journal.jsonl  (sha256-hashed, replayable, local-only) │
│    v                                                            │
│  Claude composes the final answer from primitive results.       │
│  Final reply ends with `## Provenance` citing journal IDs.      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Why engram exists

Every existing "long-context" tool for AI coding does the same thing wrong:
they bulk-load your repository into the model's context window, then bolt
retrieval, summarization, or "memory" on top. This fails for three reasons,
all of which are now well-documented in the 2026 literature:

1. **Lost in the middle.** Frontier 1M-token models drop 25–60% retrieval
   accuracy past 200K tokens. Even Gemini's 10M window doesn't escape
   attention dilution — it just delays it.
2. **Memory systems are generic.** Mem0, Letta, Zep — all general-purpose
   chat memory. None expose coding-native primitives like AST queries, git
   blame, or symbol resolution.
3. **Retrieval is unverifiable.** Production teams report inconsistent
   recall under load, hours-delayed indexing, and no way to prove what the
   agent saw at any past moment.

In December 2025, Zhang, Kraska, and Khattab (MIT CSAIL) published the
**Recursive Language Models** paper ([arXiv:2512.24601](https://arxiv.org/abs/2512.24601)).
The thesis: stop feeding long context to the model. Make the long context an
*environment* the model examines via REPL, with the option to recursively
call itself over snippets. They achieved two orders of magnitude beyond the
context window on long-context benchmarks.

**engram is the first production-grade RLM for coding agents.**

---

## Quickstart (Claude Code plugin)

```bash
# 1. Clone next to your other plugins
git clone https://github.com/Manavarya09/engram ~/.claude/plugins/engram

# 2. In Claude Code, run
/engram where does authentication happen in this repo?
```

That's it. The `/engram` command instructs Claude to use the RLM loop:
plan its traversal, call primitives in cheapness order, narrow on
truncation, recurse on density, and close with a verifiable provenance
trail of journal IDs.

## Standalone CLI

```bash
npm install -g engram

engram grep "TODO" --glob "src/**/*.ts" --max 20
engram ast src/auth.ts functions
engram read src/auth.ts 42 80
engram git log --file src/auth.ts --max 10
engram journal --tail 10
```

Requires Node ≥ 22.6 (uses `--experimental-strip-types` to run `.ts`
directly — no build step).

---

## The five primitives at a glance

| primitive | what it does                          | bound                          |
|-----------|---------------------------------------|--------------------------------|
| `grep`    | regex + glob search, file:line:col    | 50 hits, 2-line context, 2MB/file |
| `read`    | file slice, 1-indexed inclusive       | 400 lines/call                 |
| `ast`     | TS compiler API: structural queries   | 200 symbols/call               |
| `git`     | log / blame / diff over bounded scope | 30 commits, 400 lines, 32KB    |
| `recurse` | emit Task delegation directive        | depth ≤ 4, 16 snippets, 24KB   |

Every primitive call is logged to `.engram/journal.jsonl` with a
sha256-hashed result preview. The journal is **append-only**, **local-only**,
**replayable**. You can prove what engram examined at any past moment, what
came back, and what the parent Claude did with it.

---

## How it differs from what you already have

| | Claude Code default | Cursor index / Cody | Mem0 / Letta / Zep | **engram** |
|---|---|---|---|---|
| Codebase in context? | yes (`/compact` eventually) | embedded RAG | n/a (chat memory) | **no — environment only** |
| Coding-native primitives? | no (generic Read/Grep) | partial | no | **yes (ast, blame, symbol-at)** |
| Verifiable audit trail? | no | no | partial (cloud) | **yes (local sha256 journal)** |
| Recursive examination? | no | no | no | **yes (Task delegation)** |
| Local-first? | yes | yes | **no** (all cloud-first) | **yes** |
| 2025 RLM paradigm? | no | no | no | **yes** |

---

## Roadmap

This is **v0.0.1** — a credible demonstration of the paradigm. The two-week
ship was deliberate: prove the RLM loop works, journal every call, then
layer.

- **v0.1** — embeddings as a *seventh* primitive (only used when grep/ast
  miss), tree-sitter polyglot AST (Python/Go/Rust/Java), session resume
  command.
- **v0.5** — all 8 memory tiers from the architecture spec (working set,
  session journal, project state, code graph, org memory, tool log,
  decision lineage, audit). Cross-session continuation.
- **v1.0** — the "final solution" framing: provable end-to-end memory,
  cross-repo coordination, optional encrypted sync.

See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the 8-tier vision and
[docs/paper/engram.md](./docs/paper/engram.md) for the research positioning.

---

## License

MIT © 2026 Manav Arya Singh

## Citation

If you use engram in research, please cite:

```bibtex
@software{singh2026engram,
  author = {Singh, Manav Arya},
  title  = {engram: A Recursive Language Model Engine for Coding Agents},
  year   = {2026},
  url    = {https://github.com/Manavarya09/engram}
}
```

And the original RLM paper that engram is built on:

```bibtex
@article{zhang2025recursive,
  author  = {Zhang, Alex L. and Kraska, Tim and Khattab, Omar},
  title   = {Recursive Language Models},
  journal = {arXiv preprint arXiv:2512.24601},
  year    = {2025}
}
```
