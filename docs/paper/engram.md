# engram: A Recursive Language Model Engine for Coding Agents

**Manav Arya Singh** · Independent · May 2026

[github.com/Manavarya09/engram](https://github.com/Manavarya09/engram)

---

## Abstract

Long-context coding agents fail in two specific ways. First, frontier models
with one-million-token windows lose 25 to 60 percentage points of retrieval
accuracy past 200K tokens, an effect documented in 2026 needle-in-haystack
benchmarks. Second, multi-turn sessions accumulate tool outputs and
intermediate reasoning until compaction discards most of what the agent
learned. Existing agent-memory systems — Mem0, Letta, Zep — address the
second by storing chat memory, but none expose primitives appropriate to
source code, and none are verifiable in the sense that the agent's
traversal can be reconstructed from a cryptographic record.

In December 2025, Zhang, Kraska, and Khattab (MIT CSAIL) introduced
*Recursive Language Models*, a paradigm in which long context lives in an
external environment that the model examines through a REPL. The reference
implementation is general-purpose. We present **engram**, the first
specialization of that paradigm for coding agents. engram exposes five
primitives — `grep`, `read`, `ast`, `git`, `recurse` — chosen to match the
queries a coding agent actually issues. Every primitive funnels through a
single byte-budgeted runner that appends one JSON Lines entry per call to
a local journal: timestamp, primitive, arguments, SHA-256 hash over
key-sorted JSON output, bounded preview, duration. The journal is
append-only and local-only by construction, providing a verifiable record
of what the agent examined at any past moment.

engram ships as a Claude Code plugin and a standalone CLI. The codebase
is never loaded into the model's context window; the model navigates
programmatically through the primitive REPL. v0.0.1 implements two of the
eight memory tiers identified in the architecture — the journal (L2) and
the code-as-environment view (L4) — with the remaining six on the
roadmap. The full source, design contracts, and threat model are in the
project repository.

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

The Recursive Language Model paper this work specializes:

```bibtex
@article{zhang2025recursive,
  author  = {Zhang, Alex L. and Kraska, Tim and Khattab, Omar},
  title   = {Recursive Language Models},
  journal = {arXiv preprint arXiv:2512.24601},
  year    = {2025}
}
```
