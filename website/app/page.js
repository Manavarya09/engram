import { SITE_REPO } from "./seo-config";

export default function Home() {
  return (
    <main>
      <Hero />
      <Architecture />
      <Primitives />
      <Journal />
      <Compare />
      <Install />
    </main>
  );
}

// ─── HERO ─────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="section hero">
      <div className="wrap">
        <span className="hero-eyebrow">
          <span className="hero-eyebrow-dot" />
          <span>engram v0.0.1 · for Claude Code</span>
        </span>

        <h1 className="hero-title">
          The codebase is <em>never loaded</em> into context.
          Claude examines it.
        </h1>

        <p className="hero-sub">
          A Recursive Language Model engine for coding agents. Claude calls five
          primitives (<span className="mono">grep</span>,{" "}
          <span className="mono">read</span>, <span className="mono">ast</span>,{" "}
          <span className="mono">git</span>, <span className="mono">recurse</span>)
          to examine your repo on demand. Every call lands in a local,
          sha256-hashed journal. No bulk loading. No vector retrieval. No{" "}
          <span className="mono">/compact</span>.
        </p>

        <div className="hero-actions">
          <a className="btn btn-primary btn-mono" href={`${SITE_REPO}#quickstart`} target="_blank" rel="noreferrer">
            <span>Install</span>
            <span className="btn-glyph">↗</span>
          </a>
          <a className="btn btn-ghost" href="/paper">
            <span>Read the paper</span>
            <span className="btn-glyph">→</span>
          </a>
          <a className="btn btn-ghost btn-mono" href={SITE_REPO} target="_blank" rel="noreferrer">
            <span>github</span>
            <span className="btn-glyph">↗</span>
          </a>
        </div>

        <div className="hero-meta">
          <div>
            <div className="hero-meta-k">paradigm</div>
            <div className="hero-meta-v">RLM <span className="mono">(2026)</span></div>
          </div>
          <div>
            <div className="hero-meta-k">primitives</div>
            <div className="hero-meta-v"><span className="mono">5</span></div>
          </div>
          <div>
            <div className="hero-meta-k">journal</div>
            <div className="hero-meta-v"><span className="mono">sha256</span></div>
          </div>
          <div>
            <div className="hero-meta-k">runs</div>
            <div className="hero-meta-v"><span className="mono">local</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── ARCHITECTURE ─────────────────────────────────────────────────

function Architecture() {
  return (
    <section className="section" id="how">
      <div className="wrap">
        <span className="eyebrow">how it works</span>
        <h2 className="h2">
          Long context belongs in the environment, not the model.
        </h2>
        <p className="lede">
          Every turn, Claude sees the prompt plus a thin tool catalog. Not the
          repo. It traverses with the primitives. The journal records each step.
          {" "}<span className="mono">/compact</span> becomes a non-event because
          nothing was loaded in the first place.
        </p>

        <div className="diagram">
          <div className="diagram-grid">
            <Row label="01 · prompt">
              <Node mark="user" text="Where does authentication happen in this repo?" sub="≈ 14 tokens" />
            </Row>
            <Arrow />
            <Row label="02 · parent">
              <Node mark="claude" text="Reads prompt + 5-primitive tool catalog" sub="≈ 1.8K tokens" />
            </Row>
            <Arrow />
            <Row label="03 · REPL">
              <Node mark="engram.grep" text='"login|authenticate" --glob "src/**/*.ts"' sub="3 hits, 4 ms" />
            </Row>
            <Row label="">
              <Node mark="engram.ast"  text="src/auth/index.ts functions" sub="6 symbols, 12 ms" />
            </Row>
            <Row label="">
              <Node mark="engram.read" text="src/auth/index.ts 40 78" sub="38 lines, 1 ms" />
            </Row>
            <Row label="">
              <Node mark="engram.git"  text="blame --file src/auth/index.ts" sub="38 lines, 8 ms" />
            </Row>
            <Arrow />
            <Row label="04 · journal">
              <Node mark=".engram/journal.jsonl" text="4 entries appended, sha256-hashed, replayable" sub="audit chain ✓" />
            </Row>
            <Arrow />
            <Row label="05 · answer">
              <Node mark="claude" text="Composed answer cites 4 journal IDs as provenance" sub="≈ 320 tokens out" />
            </Row>
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({ label, children }) {
  return (
    <div className="diagram-row">
      <span className="diagram-label">{label}</span>
      <div>{children}</div>
    </div>
  );
}
function Node({ mark, text, sub }) {
  return (
    <div className="diagram-node">
      <span className="diagram-node-mark">{mark}</span>
      <span className="diagram-node-text">{text}</span>
      {sub ? <span className="diagram-node-sub">{sub}</span> : null}
    </div>
  );
}
function Arrow() {
  return (
    <div className="diagram-row">
      <span />
      <span className="diagram-arrow" aria-hidden>
        <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
          <path d="M9 0v18m0 0l-6-6m6 6l6-6" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </span>
    </div>
  );
}

// ─── PRIMITIVES ────────────────────────────────────────────────────

const PRIMITIVES = [
  {
    name: "grep",
    tag: "search",
    desc: "Bounded regex search across the repo with file:line:col and N-line context. Skips node_modules, .git, dist, build. Caps at 50 hits. If you hit the cap, narrow the query.",
    bound: "50 hits · 2-line ctx · 2 MB/file",
  },
  {
    name: "read",
    tag: "slice",
    desc: "A bounded line range from a file. 1-indexed, inclusive. Hard cap of 400 lines per call. No flag fetches the whole file. That's the discipline.",
    bound: "≤ 400 lines / call",
  },
  {
    name: "ast",
    tag: "structure",
    desc: "Structural queries via the TypeScript compiler API. Functions, classes, exports, imports, or the tightest node containing line:col. Works on .ts, .tsx, .mts, .cts, .js, .jsx, .mjs, .cjs.",
    bound: "≤ 200 symbols / call",
  },
  {
    name: "git",
    tag: "history",
    desc: "Bounded git views: log, blame, diff. Runs via spawn with a fixed argv. No shell, no injection. Path escapes from cwd are refused even though they couldn't reach the shell anyway.",
    bound: "30 commits · 400 blame · 32 KB diff",
  },
  {
    name: "recurse",
    tag: "delegate",
    desc: "Emits a structured ENGRAM-RECURSE-REQUEST. The parent dispatches via Claude's Task subagent. The child returns a 1–3 sentence conclusion, not a transcript, so the parent's context stays clean.",
    bound: "depth ≤ 4 · 16 snippets · 24 KB",
  },
];

function Primitives() {
  return (
    <section className="section" id="primitives">
      <div className="wrap">
        <span className="eyebrow">the five primitives</span>
        <h2 className="h2">
          Mechanical tools. The parent owns the plan.
        </h2>
        <p className="lede">
          engram never decides what to look at. Claude does. Each primitive
          returns a small, structured slice. Outputs signal truncation so Claude
          knows when to narrow. Every call is logged before the parent sees the
          response.
        </p>

        <div className="prims">
          {PRIMITIVES.map((p) => (
            <article className="prim" key={p.name}>
              <div className="prim-head">
                <span className="prim-name">engram.{p.name}</span>
                <span className="prim-tag">{p.tag}</span>
              </div>
              <p className="prim-desc">{p.desc}</p>
              <span className="prim-bound">{p.bound}</span>
            </article>
          ))}
          <article className="prim">
            <div className="prim-head">
              <span className="prim-name">runner</span>
              <span className="prim-tag">contract</span>
            </div>
            <p className="prim-desc">
              Every primitive funnels through a single byte-budgeted runner. No
              path skips the audit chain. Errors are journaled too, so silent
              failure is impossible.
            </p>
            <span className="prim-bound">single choke point · src/engine/runner.ts</span>
          </article>
        </div>
      </div>
    </section>
  );
}

// ─── JOURNAL ───────────────────────────────────────────────────────

function Journal() {
  return (
    <section className="section" id="journal">
      <div className="wrap">
        <span className="eyebrow">verifiable memory</span>
        <h2 className="h2">
          Memory you can prove.
        </h2>
        <p className="lede">
          Every call appends a JSONL line to{" "}
          <span className="mono">.engram/journal.jsonl</span> with timestamp,
          primitive, args, sha256 hash, preview, and duration. Append-only.
          Local. Replayable. You can answer "what did Claude see at 02:14?"
          with a cryptographic receipt.
        </p>

        <div className="journal">
          <Entry ts="07:50:24.987" prim="engram.ast"     args='{"file":"src/auth/index.ts","query":{"kind":"functions"}}' hash="3a7b8c…" />
          <Entry ts="07:50:25.012" prim="engram.grep"    args='{"pattern":"login","glob":"src/**/*.ts"}'                  hash="38d807…" />
          <Entry ts="07:50:25.044" prim="engram.read"    args='{"file":"src/auth/index.ts","fromLine":40,"toLine":78}'    hash="c9e1f0…" />
          <Entry ts="07:50:25.063" prim="engram.git"     args='{"mode":"blame","file":"src/auth/index.ts"}'                hash="71b3d2…" />
          <Entry ts="07:50:25.118" prim="engram.recurse" args='{"prompt":"summarize refresh path","snippets":1}'           hash="9adf4e…" />
        </div>

        <div style={{ marginTop: 18, color: "var(--fg-3)", fontSize: 13.5 }}>
          <span className="mono">cat .engram/journal.jsonl | jq</span>. It's a
          file. No daemon, no cloud, no vendor.
        </div>
      </div>
    </section>
  );
}

function Entry({ ts, prim, args, hash }) {
  return (
    <div className="journal-entry">
      <span className="journal-ts">{ts}</span>
      <span className="journal-prim">{prim}</span>
      <span className="journal-args">{args}</span>
      <span className="journal-hash">sha256:{hash}</span>
    </div>
  );
}

// ─── COMPARE ──────────────────────────────────────────────────────

const ROWS = [
  ["Codebase loaded into context?", "yes (until /compact)", "embedded RAG", "n/a (chat memory)", "no — environment only"],
  ["Coding-native primitives?",     "no (generic Read/Grep)", "partial",     "no",                "yes (ast, blame, symbol-at)"],
  ["Verifiable audit trail?",       "no",                     "no",          "partial (cloud)",   "yes (sha256 local journal)"],
  ["Recursive examination?",        "no",                     "no",          "no",                "yes (Task delegation)"],
  ["Local-first?",                  "yes",                    "yes",         "no (cloud-first)",  "yes"],
  ["2025 RLM paradigm?",            "no",                     "no",          "no",                "yes"],
];

function Compare() {
  return (
    <section className="section" id="compare">
      <div className="wrap">
        <span className="eyebrow">vs.</span>
        <h2 className="h2">
          Where engram fits.
        </h2>
        <p className="lede">
          Of the eight memory tiers a coding agent actually uses, five are
          unowned in the current ecosystem. v0.0.1 ships two of them: the
          journal (L2) and the code-as-environment view (L4). The rest are
          on the roadmap.
        </p>

        <div className="matrix">
          <div className="matrix-h" />
          <div className="matrix-h">CC default</div>
          <div className="matrix-h matrix-mobile-hide">Cursor / Cody</div>
          <div className="matrix-h matrix-mobile-hide">Mem0 / Letta</div>
          <div className="matrix-h">engram</div>
          {ROWS.map(([h, a, b, c, d]) => (
            <RowMatrix key={h} h={h} a={a} b={b} c={c} d={d} />
          ))}
        </div>
      </div>
    </section>
  );
}

function RowMatrix({ h, a, b, c, d }) {
  return (
    <>
      <div className="matrix-row-h">{h}</div>
      <div className="matrix-no">{a}</div>
      <div className="matrix-no matrix-mobile-hide">{b}</div>
      <div className="matrix-no matrix-mobile-hide">{c}</div>
      <div className="matrix-engram matrix-yes">{d}</div>
    </>
  );
}

// ─── INSTALL ──────────────────────────────────────────────────────

function Install() {
  return (
    <section className="section" id="install">
      <div className="wrap">
        <span className="eyebrow">install</span>
        <h2 className="h2">
          Plugin or CLI.
        </h2>
        <p className="lede">
          Run engram inside Claude Code via the{" "}
          <span className="mono">/engram</span> slash command, or as a
          standalone CLI in any terminal. The journal lives at{" "}
          <span className="mono">.engram/journal.jsonl</span> next to your
          repo either way.
        </p>

        <div className="install">
          <div className="install-card">
            <div className="install-card-h">Claude Code plugin</div>
            <div className="install-cmd">
              <span><span className="install-cmd-prompt">$</span>git clone {SITE_REPO} ~/.claude/plugins/engram</span>
              <span className="install-cmd-copy">copy</span>
            </div>
            <p className="install-card-sub">
              Then run{" "}
              <span className="mono" style={{ color: "var(--grn-4)" }}>/engram &lt;question&gt;</span>{" "}
              in Claude Code. The slash command tells the model to traverse via
              primitives, narrow on truncation, and close with a provenance
              trail of journal IDs.
            </p>
          </div>

          <div className="install-card">
            <div className="install-card-h">Standalone CLI</div>
            <div className="install-cmd">
              <span><span className="install-cmd-prompt">$</span>npm install -g engram</span>
              <span className="install-cmd-copy">copy</span>
            </div>
            <p className="install-card-sub">
              Needs Node 22.6+. engram ships{" "}
              <span className="mono">.ts</span> directly, no build step. Try{" "}
              <span className="mono" style={{ color: "var(--grn-4)" }}>engram ast src/index.ts functions</span>{" "}
              to see the journal grow.
            </p>
          </div>
        </div>

        <div style={{ marginTop: 40, padding: "20px 24px", border: "1px solid var(--hairline)", borderRadius: 18, background: "var(--panel)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: "var(--ff-mono)", fontSize: 11, color: "var(--grn-4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>research positioning</div>
            <div style={{ fontSize: 15 }}>The full paper: motivation, design contracts, evaluation methodology, threat model, 8-tier hierarchy.</div>
          </div>
          <a className="btn btn-primary btn-sm" href="/paper">
            <span>Read the paper</span>
            <span className="btn-glyph">→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
