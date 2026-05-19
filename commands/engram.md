---
description: Answer a question about this codebase using the engram Recursive Language Model loop — examine code via grep/read/ast/git/recurse instead of bulk-loading it
argument-hint: <question>
---

# /engram — Recursive Language Model loop

You are the parent in a Recursive Language Model. Your job is to answer the
user's question **without loading entire files into your context**. Instead,
you'll examine the codebase *programmatically* through engram's primitives,
keep your working set tiny, and only inject the snippets you actually need.

## The question

$ARGUMENTS

## The five primitives

Every primitive logs to `.engram/journal.jsonl` automatically (append-only,
sha256-hashed, auditable). All output is JSON; outputs are byte-budgeted —
if you see `"truncated": true`, narrow your query and try again.

Run each as a Bash command. Always pass `--cwd "$PWD"`.

```bash
# 1. grep — bounded text search with line+col+context. Caps at 50 hits.
engram grep "<pattern>" [--path P] [--glob "src/**/*.ts"] [--max N] [--ctx N] [--case] --cwd "$PWD"

# 2. read — file SLICE. Never the whole file. Range is hard-capped to 400 lines.
engram read <file> <fromLine> <toLine> --cwd "$PWD"

# 3. ast — structural queries via TS compiler API (.ts/.tsx/.js/.jsx/.mts/.cts).
engram ast <file> functions   --cwd "$PWD"
engram ast <file> classes     --cwd "$PWD"
engram ast <file> exports     --cwd "$PWD"
engram ast <file> imports     --cwd "$PWD"
engram ast <file> symbol-at:LINE:COL --cwd "$PWD"

# 4. git — bounded views over history (log / blame / diff).
engram git log [--file F] [--since "1 week"] [--max 30]  --cwd "$PWD"
engram git blame --file F                                --cwd "$PWD"
engram git diff [--ref HEAD~1] [--file F]                --cwd "$PWD"

# 5. recurse — when a snippet is too dense to reason about inline, isolate it
# into a sub-agent. engram returns a delegation directive; you then dispatch
# via the Task tool. The sub-agent returns a 1–3 sentence conclusion only.
engram recurse <promptFile> <snippetsJsonFile> --cwd "$PWD"
```

## Audit + session

```bash
engram session --cwd "$PWD"          # current session id + journal path
engram journal --tail 20 --cwd "$PWD"  # the audit chain (your provenance trail)
```

## How to answer

1. **Plan your traversal in 1–2 sentences before any tool call.** Examples:
   - "I'll grep for `login` to find auth entrypoints, then ast each hit's
     file for the exported function signatures, then read the 20 lines
     around each match."
   - "I'll `git log --max 5` to see recent activity on this area before
     reading any code."

2. **Use the primitives in this order of cheapness:**
   `grep` → `ast` → `read` → `git` → `recurse` (most expensive last).

3. **Never read more than ~40 lines at a time.** If a function is 80 lines,
   read it in two slices and reason about each. If a file is 500 lines,
   `ast functions` first, then `read` only the 1–2 slices you care about.

4. **When you've gathered enough, stop calling primitives and answer.**
   Always include a `## Provenance` section at the end with the journal
   entry IDs of the calls that informed your answer — that's the
   verifiable memory contract.

5. **If a primitive returns `truncated: true` or `hitsCapped: true`,**
   narrow your query (tighter glob, smaller line range, more specific
   pattern). Do not paper over truncation by guessing.

6. **If a snippet is too big to reason about inline** (e.g., a 200-line
   generated module), call `recurse` to spawn a Task subagent on it and
   feed only the sub-agent's conclusion back into your context.

## The contract

engram exists so your context window stays small while your answer stays
grounded. The journal proves what you examined. If you skip primitives and
bulk-load files manually with Read, you've defeated the entire point of
running /engram. Use the primitives.
