# Comparison with existing tools

## Landscape

The 2025-2026 AI coding tool ecosystem has four categories of "memory" or "context" solutions. engram fits none of them — it implements the Recursive Language Model (RLM) paradigm (Zhang, Kraska, Khattab 2025), where long context lives in the **environment** and the model navigates it via a **REPL of coding-native primitives**.

## Feature matrix

| | Claude Code default | Cursor index / Cody | Mem0 / Letta / Zep | engram |
|---|---|---|---|---|
| Codebase in context | Yes (until `/compact`) | Embedded RAG | N/A (chat memory) | **No — environment only** |
| Coding-native primitives | No (generic Read/Grep) | Partial | No | **Yes: ast, git blame, symbol-at** |
| Verifiable audit trail | No | No | Partial (cloud) | **Yes: local sha256 journal** |
| Recursive examination | No | No | No | **Yes: Task delegation via recurse** |
| Local-first | Yes | Yes | **No (all cloud-first)** | **Yes** |
| 2025 RLM paradigm | No | No | No | **Yes** |
| Output bounds | No (reads entire files) | No | N/A | **Yes (byte-budgeted, capped)** |
| Threat model | None documented | None documented | None public | **Documented (ARCHITECTURE.md)** |

## Detailed comparisons

### vs. Claude Code default

Claude Code's native tools (`Read`, `Grep`, `Bash`) have no output bounds. `Read` by default returns the entire file. `Grep` returns all matches. This means Claude can — and does — bulk-load large portions of the codebase into context, triggering context window pressure and eventual `/compact`.

engram's bounded primitives prevent this by design. Claude reads code through the same interface but never gets a whole file at once. The `truncated: true` signal tells it to narrow its query, not guess.

The journal is the structural difference. Without engram, there is no record of what Claude examined, in what order, or what came back. engram's `.engram/journal.jsonl` provides this for every call.

### vs. Cursor index / Cody

Cursor and Cody use embedded RAG over a vector index of the codebase. They can answer "find me the authentication logic" without loading the whole repo, but:

- **No audit trail.** There is no record of what chunks were retrieved or how they influenced the answer.
- **No coding-native primitives.** They cannot answer "what are the exports of this file" or "who last modified this function and when" through their index — they must fall back to general-purpose retrieval.
- **Retrieval is approximate.** Vector similarity can miss exact matches that a regex grep would find instantly. engram's grep is exact; engram's ast is structural.

### vs. Mem0 / Letta / Zep

These are general-purpose chat memory systems. They store conversation history, user preferences, and entity summaries. They are not designed for codebase navigation and have no coding-native primitives whatsoever.

The overlap is in the "memory" label. engram is not a memory product — it is a **REPL for coding agents** that happens to journal its calls. The 8-tier memory hierarchy in `docs/ARCHITECTURE.md` shows the roadmap; the REPL is the first paving stone.

### vs. IDE plugins (GitHub Copilot, Codeium, Supermaven)

These provide inline completions and chat UI within an editor. They are designed for the human-at-keyboard workflow. engram is designed for the **autonomous agent** workflow — Claude driving analysis programmatically through a CLI, with every decision auditable.

## When each tool makes sense

| Use case | Best tool |
|---|---|
| "Complete this function as I type" | Copilot / Supermaven |
| "What's the git history of this file?" | **engram `git log --file`** |
| "Summarize my chat history" | Mem0 / Letta |
| "Where is authentication handled?" | engram (grep → ast → read) or Cursor index |
| "Prove what the agent examined at time T" | **engram journal** |
| "Cross-reference a refactor across 50 files" | engram (grep → recurse on density) |
| "Chat memory across sessions" | Mem0 / Letta / Zep |
