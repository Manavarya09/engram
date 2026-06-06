# Security

## Threat model

engram runs locally on the developer's machine and produces a local audit log. The following threats are addressed in v0.

### Command injection via primitive args

**Risk:** Malicious file paths, ref strings, or patterns injected into primitive arguments could escape into shell execution.

**Mitigation:** Every subprocess call uses `spawnSync("git", argv, ...)` with a fixed `argv` array — no shell, no string interpolation. Git args (refs, file paths, since-strings) pass through as literal arguments without shell interpretation. See `src/primitives/git.ts:53-61`.

### Path escape from cwd

**Risk:** An attacker-controlled file path like `../../etc/passwd` could read files outside the repo root.

**Mitigation:** The git primitive's `resolveFile()` resolves the path against `cwd` and rejects any result that does not start with `cwd`. The read primitive uses `path.resolve(cwd, file)` and relies on `statSync` natural EACCES errors. See `src/primitives/git.ts:163-171`.

### Unbounded resource use

**Risk:** A malicious or buggy query could exhaust disk I/O, memory, or CPU.

**Mitigation:** Every primitive enforces hard caps enforced by the runner:

| Primitive | Bound |
|-----------|-------|
| grep | 50 hits, 2-line context, 2MB/file |
| read | 400 lines/call |
| ast | 200 symbols/call |
| git log | 30 commits |
| git blame | 400 lines |
| git diff | 32KB |
| recurse | depth ≤4, 16 snippets, 24KB |

The runner's `enforceBudget()` (`src/engine/runner.ts:91-124`) truncates oversize results and signals the caller via `truncated: true`.

### Audit-log tampering

**Risk:** An attacker modifies `.engram/journal.jsonl` to hide their activity.

**Mitigation:** The journal is append-only. Every entry contains a `resultHash: sha256` over key-sorted JSON of the result. Any post-hoc edit causes a hash mismatch on replay. See `src/engine/journal.ts:45-48`.

### Not addressed in v0

- **Malicious Claude bypassing engram.** A Claude instance that chooses to use native Read/Grep tools instead of engram primitives bypasses the journal entirely. The `hooks/pretool-hint.py` advises the model but does not block. Verification of honor is a v0.5 goal.
- **Local user with journal access.** `.engram/journal.jsonl` is private to the user. Treat it like git history — sensitive, local-only. No encryption in v0.

## Reporting a vulnerability

Open an issue at https://github.com/Manavarya09/engram/issues with the "security" label.

For sensitive disclosures, email the author directly (see package.json author field). We commit to:

- Acknowledgment within 48 hours
- A fix or mitigation plan within 7 days
- A CVE if the vulnerability affects downstream consumers
