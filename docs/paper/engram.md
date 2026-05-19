# engram: A Recursive Language Model Engine for Coding Agents

**Manav Arya Singh**
*Independent · 2026*

`engram@manavarya.com` · [github.com/Manavarya09/engram](https://github.com/Manavarya09/engram)

---

## Abstract

We present **engram**, the first production-grade Recursive Language Model
(RLM) engine specialized for coding agents. Existing long-context approaches
in 2026 — frontier 1M–10M-token windows, retrieval-augmented generation, and
generic agent memory systems (Mem0, Letta, Zep) — share a common failure
mode: they push the codebase *into* the model. Empirical evidence from
needle-in-haystack benchmarks shows 25–60% retrieval degradation past 200K
tokens across every frontier model except Gemini 3 Deep Think
([Digital Applied 2026](https://www.digitalapplied.com/blog/long-context-retrieval-needle-in-haystack-2026)).
The "lost in the middle" effect compounds across multi-turn agent sessions,
and production teams using vector-based memory systems report inconsistent
recall and hours-delayed indexing
([Mem0 2026](https://mem0.ai/blog/state-of-ai-agent-memory-2026)).

Building on the Recursive Language Models paradigm
([Zhang, Kraska, Khattab 2025](https://arxiv.org/abs/2512.24601)) — in
which long prompts are treated as an external environment a language model
programmatically examines via REPL — engram instantiates this paradigm with
five **coding-native primitives** (`grep`, `read`, `ast`, `git`, `recurse`)
exposed to a parent agent through a stable JSON contract. Every primitive
call is recorded in an append-only, sha256-hashed local journal, yielding a
**verifiable memory** layer absent from all surveyed alternatives.

This paper (i) positions engram in the 2026 long-context landscape;
(ii) formalizes its four design contracts; (iii) characterizes the
"infinite context" property as an *operational* — not informational —
guarantee; (iv) describes the v0.0.1 implementation, evaluation
methodology, and threat model; and (v) outlines the eight-tier memory
hierarchy that constitutes the v1.0 roadmap.

---

## 1. Introduction

### 1.1 The long-context problem in coding agents

The dominant trend in commercial LLMs from 2023–2026 has been ever-larger
context windows: 4K → 32K → 128K → 1M → 10M tokens. For coding agents this
has been pitched as the solution to *codebase-scale* reasoning: load the
repository, ask the question, get an answer. In practice, three failure
modes have emerged.

**Lost in the middle.** The seminal Stanford observation
([Liu et al. 2023](https://arxiv.org/abs/2307.03172)) — that LLMs recall
information at the *beginning* and *end* of a context window far better
than information in the middle — has not been resolved by scale. Recent
independent benchmarks ([TokenMix 2026](https://tokenmix.ai/blog/llm-context-window-explained))
report that frontier 1M models drop 30–60 percentage points of retrieval
accuracy between 200K and 1M tokens, and that "11 out of 13 LLMs dropped
below 50% of their baseline scores at just 32K tokens" on tasks that
required actual reasoning rather than surface-level pattern matching
([Digital Applied 2026](https://www.digitalapplied.com/blog/ai-context-window-comparison-2026-1m-to-10m-tokens)).

**Attentional dilution in multi-turn sessions.** Even when individual
turns fit comfortably in the window, agentic sessions accumulate tool
outputs, intermediate reasoning, and re-injected codebase chunks across
turns. ([Mongo 2026](https://www.mongodb.com/company/blog/technical/why-multi-agent-systems-need-memory-engineering))
documents that "high-performing models become as unreliable as smaller
ones in extended dialogues." For a coding agent driving a multi-hour
debugging session, this manifests as Claude or its peer forgetting earlier
decisions, re-deriving ruled-out hypotheses, and losing thread on the
larger plan.

**Memory systems are non-coding.** A robust ecosystem now exists for LLM
agent memory: Mem0 (47K+ GitHub stars), Letta, Zep, Cognee, and
others ([Bhardwaj 2026](https://dev.to/varun_pratapbhardwaj_b13/5-ai-agent-memory-systems-compared-mem0-zep-letta-supermemory-superlocalmemory-2026-benchmark-59p3)).
All target *conversational* memory: facts about the user, prior topics,
state changes over time. None expose primitives appropriate to source code
(AST queries, symbol resolution, blame/diff, structured imports). Cursor's
codebase index and Sourcegraph's code graph approach the right substrate
but stop at retrieval; they do not provide an integrated REPL for an
external agent.

### 1.2 The RLM paradigm

In December 2025, [Zhang, Kraska, Khattab](https://arxiv.org/abs/2512.24601)
introduced **Recursive Language Models**: a paradigm in which the long
prompt is *not* fed to the model but is instead exposed as an environment
that the model symbolically interacts with through a REPL, with the
ability to recursively invoke itself over snippets. Their experiments
achieved two orders of magnitude beyond the underlying model's context
window on long-context benchmarks while *outperforming* the vanilla model
at the same task.

The RLM thesis decouples two things that LLM design has historically
conflated: **information access** and **information ingestion**. The model
needs *access* to long content to answer questions about it; it does not
need to *ingest* (read into context) all of it. A REPL is a clean
abstraction for the access/ingestion separation. The model decides what
to look at; only what it explicitly retrieves enters its working memory.

### 1.3 Contribution

engram is the **first production-grade RLM specialized for coding
agents**. Where the original RLM paper proposes a general-purpose REPL
(`exec`, `find`, `summarize`), engram exposes five coding-native
primitives chosen to match the queries a coding agent actually issues:

- **`grep`** — bounded text search across the repository, with file:line:col
  and N-line context.
- **`read`** — file slices with a hard cap of 400 lines per call.
- **`ast`** — structural queries (functions, classes, exports, imports,
  symbol-at) via the TypeScript compiler API.
- **`git`** — bounded views of `log`, `blame`, `diff`.
- **`recurse`** — emit a delegation directive consumed by the parent
  agent's subagent-spawning mechanism.

Every primitive call is journaled to an append-only local audit log with
sha256-hashed result digests, yielding a **verifiable memory** property
that — to our knowledge — no other agent memory system provides.

The contribution is threefold:

1. **First coding-specialized RLM**, instantiating the Zhang et al.
   paradigm with primitives appropriate to source code.
2. **Verifiable local memory**, with cryptographically hashed, append-only
   audit chain replayable at any time.
3. **Plugin integration**, making the RLM loop directly available inside
   Claude Code's native agent surface via a slash command.

---

## 2. Design contracts

engram is governed by four invariants. Every implementation choice flows
from these.

### Contract 1: The model never bulk-loads

No primitive returns a whole file. No primitive returns "all matches."
Outputs are byte-budgeted and count-capped. When a budget is exceeded,
the response signals `truncated: true` or `hitsCapped: true` to the
parent, which is expected to narrow its query rather than paper over
the truncation.

This contract is the *operational* manifestation of the RLM separation
between access and ingestion. A 50,000-line repository remains fully
*accessible* to the parent agent through the primitives; only the
specific 40-line slices the parent explicitly requests are *ingested*
into its working memory.

### Contract 2: The journal is the source of truth

Every primitive call appends a single JSONL line to `.engram/journal.jsonl`
containing:

- a UUID
- ISO-8601 timestamp
- primitive name
- arguments (deterministically serialized)
- sha256 hash of the result (first 16 hex chars)
- bounded result preview
- duration in milliseconds
- working directory
- session id

The hash is computed over **key-sorted** JSON, making it deterministic
under object key reordering. The journal is **append-only** and
**local-only** by construction. No primitive writes anywhere else.

### Contract 3: The parent owns the plan

engram never decides what to look at; the parent agent does. The
primitives are mechanical mechanisms; the strategy (e.g., "grep first,
then ast, then read") lives in the `/engram` slash command's
instructions, not in the engram source code. This decouples the engine
from any particular parent model, and keeps the model accountable for
its traversal — which is also what makes the audit log meaningful.

### Contract 4: Recursion is bounded

The `recurse` primitive is depth-capped (default 4), snippet-count-capped
(16), and aggregate-byte-capped (24KB). The "recursive" in RLM is
structural, not infinite. Practical RLM systems must guard against
runaway delegation; engram refuses to emit a delegation directive that
would exceed the current depth budget.

---

## 3. The five primitives

| primitive | bound                                | journals as | typical caller intent |
|-----------|--------------------------------------|-------------|------------------------|
| `grep`    | 50 hits, 2-line ctx, 2MB/file, regex+glob | `grep`  | "where is X used / mentioned" |
| `read`    | 400 lines/call, 1-indexed inclusive  | `read`      | "show me lines N–M of file F" |
| `ast`     | 200 symbols/call, TS compiler API    | `ast`       | "what functions does F define" |
| `git`     | 30 commits, 400 blame lines, 32KB diff | `git`     | "who changed this, when, why" |
| `recurse` | depth ≤ 4, 16 snippets, 24KB total   | `recurse`   | "analyze this dense snippet for me" |

### 3.1 `grep`

A pure-JS tree walker (skipping `node_modules`, `.git`, `dist`, `build`,
`.next`, `.nuxt`, `.turbo`, `.vercel`, `.cache`, `coverage`, `.engram`),
applying a compiled regex (with fall-through to literal if the regex is
malformed) to every line of every text file under the configured `--path`.
Hits include file, line, column, and N-line context windows. Binary
heuristic: files containing a null byte are skipped.

### 3.2 `read`

A bounded line range from a file. The 400-line per-call cap is the
discipline; callers must narrow their slice. The clamping behavior (a
`toLine` past EOF clamps without throwing, while a `toLine < fromLine`
errors) matches the principle of charitable interpretation for natural
queries.

### 3.3 `ast`

Single-file structural queries via TypeScript's `createSourceFile` (no
program, no checker, so query latency is sub-50ms for typical files and
no `tsconfig.json` discovery is required). Supported extensions:
`.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.jsx`, `.mjs`, `.cjs`.

The five query kinds:

- **`functions`** — function declarations, methods, and arrow-const
  function expressions, with their export status and signatures.
- **`classes`** — class declarations, interfaces, and type aliases.
- **`exports`** — named exports, default exports, export-from
  re-exports, namespace exports.
- **`imports`** — default, named, namespace, and side-effect imports.
- **`symbol-at:LINE:COL`** — the tightest-spanning named node
  containing the cursor.

### 3.4 `git`

`spawnSync('git', argv)` with a fixed argv (no shell). Three modes:

- **`log`** — `log -n N --pretty=format:%H%x09%an%x09%aI%x09%s`,
  optionally with `--since` and `-- <file>`.
- **`blame`** — `blame --porcelain <file>`, parsed into per-line
  records of `{line, sha, author, date, text}`, capped at 400 lines.
- **`diff`** — `diff <ref>` optionally scoped to `<file>`, output
  capped at 32KB.

Defense-in-depth: `resolveFile()` rejects paths that resolve outside
the configured cwd, even though we already use `execFile`-style spawn
(no shell-injection vector).

### 3.5 `recurse`

The RLM core. Unlike a generic RLM where the engine itself invokes the
sub-LLM, engram in v0 emits a structured `ENGRAM-RECURSE-REQUEST`
directive consumed by Claude Code's native `Task` subagent tool. This
decision was deliberate: it avoids hard-coding an API key path into
engram, it inherits Claude Code's native subagent auditability, and it
keeps the parent model accountable for the delegation decision.

The directive specifies:

- a fresh recurse id (uuid)
- the next depth, gated against `ENGRAM_RECURSE_DEPTH < maxRecurseDepth`
- the sub-prompt
- the snippets the sub-agent should reason over
- explicit instructions that the sub-agent return a 1–3 sentence
  conclusion only (not a transcript) so the parent's context stays
  clean

---

## 4. Implementation

engram v0.0.1 is implemented in TypeScript, targeting Node 22.6+. It uses
Node's `--experimental-strip-types` to run `.ts` source directly: there is
no build step and no shipped `dist/`. The runtime dependency footprint is
a single package, `typescript` (used only via the compiler API for the
`ast` primitive). All other functionality uses Node built-ins.

The architectural layout:

```
src/
├── types.ts        — every public contract (PrimitiveOutput<T> discriminated union, …)
├── index.ts        — programmatic re-exports
├── cli.ts          — argv → primitive dispatch
├── engine/
│   ├── journal.ts  — append-only JSONL with sha256-stable hashing
│   ├── session.ts  — env-aware EngramConfig (ENGRAM_SESSION_ID, ENGRAM_JOURNAL)
│   └── runner.ts   — the choke point: byte-budget enforcement + journal append
└── primitives/
    ├── grep.ts
    ├── read.ts
    ├── ast.ts
    ├── git.ts
    └── recurse.ts
```

The **runner** is the single point through which every primitive returns
to the caller. It is the only code path that touches the journal. This
guarantees no primitive can skip the audit chain, and byte-budget
enforcement is uniform across primitives (truncation strategies differ
slightly: arrays drop the tail proportionally, long strings get a
sentinel-marked suffix elision).

The CLI emits stable JSON to stdout (default) or pretty-printed JSON
under `--human`. Exit codes are precisely defined: `0` for successful
primitive, `2` for primitive-level error (with the structured error
still on stdout), `64` for usage error, `1` for unexpected throw.

### 4.1 Test methodology

engram v0.0.1 has 34 tests using Node's built-in test runner (`node --test`).
Tests are hermetic: each makes a tmp directory, populates fixtures,
runs the primitive, and asserts on the structured output. The `git`
tests use `GIT_AUTHOR_*` / `GIT_COMMITTER_*` environment variables and
`GIT_CONFIG_GLOBAL=/dev/null` to remain insensitive to the host's git
configuration (some hosts install hooks that gate `user.email` writes).

All 34 tests pass; `tsc --noEmit` reports zero errors under strict mode
with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.

---

## 5. Evaluation methodology

A formal evaluation of engram against the alternatives (1M-token Claude,
Cursor index, Mem0-backed retrieval, naive RAG) is out of scope for this
v0.0.1 release. We outline below the evaluation methodology we intend to
apply for v0.1, based on the benchmark families that have emerged in
2025–2026.

### 5.1 Long-context coding benchmarks

- **GSM-∞** ([arXiv:2502.05252](https://arxiv.org/html/2502.05252v1)) —
  reasoning under increasing context length; though arithmetic-flavored,
  it isolates context-length effects from semantic difficulty. We will
  evaluate engram-driven Claude versus baseline Claude on a code-adapted
  variant.
- **Needle-in-haystack** in real repositories — we will measure recall
  of a planted symbol/comment at varying repo sizes, comparing
  engram-mediated traversal against bulk-load-into-context baselines.

### 5.2 Verifiability evaluation

A unique-to-engram axis: the **replayability test**. Given a session's
journal, can we deterministically reconstruct the agent's reasoning
chain? engram's append-only sha256-hashed journal is designed so the
answer is yes; we will quantify this against Mem0/Letta/Zep, which to
our knowledge cannot pass this test.

### 5.3 Cost evaluation

Total tokens billed to the underlying LLM provider for a fixed set of
queries (e.g., "find all callers of `authenticate()` and explain how the
session-refresh logic works") via:

- **bulk-load baseline** — read the whole repo into Claude's context,
  ask the question.
- **engram-mediated** — `/engram` plus the same question.

We hypothesize engram will reduce token spend by 10–100× on
medium-to-large repositories, while improving accuracy due to the
absence of attentional dilution.

---

## 6. Threat model

### 6.1 Defended threats

- **Command injection** — all subprocess invocations use
  `spawnSync(cmd, argv, ...)` with a fixed argv. User-controlled strings
  pass directly as `git` arguments, with no shell in the path.
- **Path traversal** — the `git` primitive's `resolveFile` rejects any
  resolved path that does not start with the configured cwd. The `read`
  primitive uses `path.resolve(cwd, file)` and relies on natural EACCES
  for permission boundaries.
- **Unbounded resource use** — byte budgets, hit caps, file-size caps,
  recurse depth/count/byte caps. The runner is the choke point.
- **Audit-log tampering** — JSONL is append-only and the result hash is
  sha256 over key-sorted JSON, so any post-hoc edit shows up as a
  mismatch when the journal is replayed.

### 6.2 Out-of-scope for v0

- **A malicious parent that ignores engram.** The `/engram` command's
  instructions ask the parent to honor the RLM contract; verification
  that it did so is a v0.5 problem (the `hooks/hooks.json` seam exists
  for this).
- **A malicious local user with read access to `.engram/journal.jsonl`.**
  The journal contains every snippet engram returned to the agent. Treat
  it like `.git/` — sensitive, local-only, do not commit.

---

## 7. The eight-tier memory hierarchy (v1.0 vision)

Drawing on the LLM-as-OS lineage from MemGPT
([Packer et al. 2023](https://arxiv.org/abs/2310.08560))
and recent agent-memory taxonomies, we organize engram's roadmap around
an explicit eight-tier hierarchy:

| Tier | Name              | What lives here                                | v0   |
|------|-------------------|------------------------------------------------|------|
| L0   | Active window     | Current turn's tokens                          | ✓    |
| L1   | Conversation buffer | Recent turns                                  | n/a  |
| L2   | Session journal   | Every primitive call (decisions, hypotheses)   | **✓** |
| L3   | Project state     | Pending TODOs, branch context, last intent     | v0.5 |
| L4   | Repo knowledge    | Code graph (engram exposes via primitives)     | **✓** |
| L5   | Org memory        | Patterns across all your repos                 | v1.0 |
| L6   | Tool log          | Test outputs, builds, errors                   | v0.5 |
| L7   | Decision lineage  | Why X over Y, what was tried                   | v0.5 |

The competitive landscape today owns at most L4 — and even there, none
expose coding-native primitives. Five of the eight tiers are unowned.
engram aims at all of them.

---

## 8. Related work

**Recursive Language Models.** Zhang, Kraska, Khattab (MIT CSAIL 2025)
introduced the paradigm engram instantiates. Their reference
implementation [`micro-rlm`](https://github.com/Sha01in/micro-rlm) (400
LOC) and [`alexzhang13/rlm`](https://github.com/alexzhang13/rlm) (plug-and-
play library) are general-purpose; engram is the coding-specialized
counterpart.

**Long-context retrieval and RAG.** A vast literature; the
[Liu et al. 2023](https://arxiv.org/abs/2307.03172) "Lost in the Middle"
result frames the failure mode engram is designed to sidestep.
([Anthropic 2025](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents))
"Effective context engineering for AI agents" advocates careful curation
of what enters the window — engram operationalizes this advice into a
mechanical contract.

**LLMs as operating systems.** MemGPT
([Packer et al. 2023](https://arxiv.org/abs/2310.08560)) and its
descendants treat agent memory as a multi-tier hierarchy with
paging. Letta is the operational continuation. engram shares the OS
metaphor in its 8-tier hierarchy but differs sharply in two ways:
(i) it specializes to *code* rather than chat; (ii) the parent agent —
not engram — drives paging, via the primitive REPL.

**Agent memory products.** Mem0, Letta, Zep, Cognee — surveyed in
([Bhardwaj 2026](https://dev.to/varun_pratapbhardwaj_b13/5-ai-agent-memory-systems-compared-mem0-zep-letta-supermemory-superlocalmemory-2026-benchmark-59p3))
— focus on conversational memory and chat history; none expose
coding-native primitives or verifiable journals.

**Codebase indexers.** Cursor's symbol index, Sourcegraph's code
intelligence, Glean's enterprise code graph, Bloop's semantic search.
All provide *retrieval surfaces* over code. engram extends this
substrate into a full REPL with auditability and recursion.

---

## 9. Limitations and future work

**Language coverage.** v0's `ast` primitive supports only the TS/JS
family (the languages the `typescript` package can parse). v0.1 will
introduce a tree-sitter backend for Python, Go, Rust, Java, and
Ruby; the primitive contract is unchanged.

**No embeddings.** v0 deliberately ships without a vector primitive.
The hypothesis is that for *most* coding queries, `grep + ast + git`
is sufficient, and that embedding-based retrieval is a fallback rather
than a default. v0.1 will add a seventh primitive (`semantic`)
gated behind explicit opt-in.

**Single-repo scope.** v0 operates on one repository at a time.
Cross-repo coordination (L5 in the hierarchy) is a v1.0 target.

**Sub-agent trust.** The `recurse` primitive emits a directive but
cannot enforce that the parent honors it. v0.5 will add a
`PreToolUse`-style hook that verifies the parent dispatched via Task
when a recurse directive was emitted.

**Empirical evaluation.** Section 5 lays out the methodology but the
evaluation itself is v0.1 work.

---

## 10. Conclusion

The "infinite context" framing that has dominated AI coding in 2024–2026
has been an attempt to solve an *informational* problem (the model needs
more material) with an *informational* tool (bigger windows). The Zhang
et al. RLM result reframes the problem as *operational*: the model
needs *access*, not *ingestion*. engram brings that reframing to coding
agents, with five primitives chosen for the queries coding agents
actually issue, and an append-only journal that turns "memory" from a
black box into a verifiable, replayable artifact.

The infinite-feeling context isn't infinite. It's the absence of bulk
loading.

---

## Acknowledgments

This work builds directly on Recursive Language Models
([Zhang, Kraska, Khattab 2025](https://arxiv.org/abs/2512.24601)) and is
deeply informed by Anthropic's published context-engineering guidance
([Anthropic 2025](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)).

## References

1. Zhang, A. L., Kraska, T., Khattab, O. *Recursive Language Models.*
   arXiv:2512.24601, December 2025.
   <https://arxiv.org/abs/2512.24601>
2. Liu, N. F., Lin, K., Hewitt, J., Paranjape, A., Bevilacqua, M.,
   Petroni, F., Liang, P. *Lost in the Middle: How Language Models Use
   Long Contexts.* arXiv:2307.03172, 2023.
3. Packer, C., Fang, V., et al. *MemGPT: Towards LLMs as Operating
   Systems.* arXiv:2310.08560, 2023.
4. Anthropic. *Effective context engineering for AI agents.* 2025.
   <https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents>
5. Digital Applied. *AI Context Window Comparison 2026: 1M to 10M Tokens.*
   2026.
   <https://www.digitalapplied.com/blog/ai-context-window-comparison-2026-1m-to-10m-tokens>
6. Digital Applied. *Long-Context Retrieval 2026: Needle-in-Haystack Test.*
   2026.
   <https://www.digitalapplied.com/blog/long-context-retrieval-needle-in-haystack-2026>
7. Bhardwaj, V. P. *5 AI Agent Memory Systems Compared: Mem0, Zep, Letta,
   Supermemory, SuperLocalMemory (2026 Benchmark Data).* DEV Community, 2026.
8. Mem0. *State of AI Agent Memory 2026: Benchmarks, Architectures &
   Production Gaps.* 2026.
   <https://mem0.ai/blog/state-of-ai-agent-memory-2026>
9. *GSM-∞: How Do Your LLMs Behave over Infinitely Increasing Context
   Length and Reasoning Complexity?* arXiv:2502.05252, 2025.

---

## Citation

```bibtex
@software{singh2026engram,
  author = {Singh, Manav Arya},
  title  = {engram: A Recursive Language Model Engine for Coding Agents},
  year   = {2026},
  url    = {https://github.com/Manavarya09/engram}
}
```
