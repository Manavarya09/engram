import Link from "next/link";
import { SITE_REPO } from "./seo-config";

const SECTIONS = [
  { id: "why",        title: "Why context windows aren't the answer" },
  { id: "idea",       title: "The idea" },
  { id: "primitives", title: "The primitives" },
  { id: "journal",    title: "The journal" },
  { id: "fits",       title: "Where it fits" },
  { id: "install",    title: "Install" },
  { id: "next",       title: "What's next" },
];

export default function Home() {
  return (
    <article className="doc">
      <Toc />
      <Body />
    </article>
  );
}

function Toc() {
  return (
    <aside className="doc-toc" aria-label="Table of contents">
      <div className="doc-toc-h">Contents</div>
      <nav>
        <ol>
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`}>{s.title}</a>
            </li>
          ))}
        </ol>
      </nav>
      <hr className="doc-toc-rule" />
      <div className="doc-toc-meta">
        Manav Arya Singh<br />
        May 2026<br />
        MIT
      </div>
    </aside>
  );
}

function Body() {
  return (
    <div className="doc-body">

      <h1 className="doc-title">
        <span className="doc-mark-lg" aria-hidden>ɘ</span>
        <span>engram</span>
      </h1>
      <p className="doc-dek">
        A Recursive Language Model engine for Claude Code. The codebase isn't
        loaded into context. Claude examines it through five logged primitives.
      </p>
      <p className="doc-byline">
        Manav Arya Singh · May 2026
      </p>

      <div className="doc-tldr">
        <div className="doc-tldr-h">tl;dr</div>
        <div>
          Long context windows lose 25&ndash;60% retrieval accuracy past
          200K tokens, and <span className="mono">/compact</span> erases the
          rest. engram skips loading entirely. Claude calls five primitives
          (<span className="mono">grep</span>, <span className="mono">read</span>,{" "}
          <span className="mono">ast</span>, <span className="mono">git</span>,{" "}
          <span className="mono">recurse</span>) and every call is journaled.
        </div>
      </div>

      <hr className="doc-rule" />

      <p>
        I built engram one weekend after losing a four-hour debug session to{" "}
        <span className="mono">/compact</span> for the second time that week.
        Claude had figured out the bug, ruled out three wrong theories, walked
        me through the auth flow, and then the conversation compacted and most
        of what we'd worked out got summarized away into five lines.
      </p>

      <p>
        The premise is simple. Claude doesn't need to <em>load</em> your code
        to reason about it; it needs to <em>access</em> it. Loading is what
        context windows do. It's expensive, it dilutes attention, and it
        eventually crashes into <span className="mono">/compact</span>. Access
        is what a REPL does: call a tool, get a small answer back, decide what
        to ask next.
      </p>

      <p>engram is that REPL.</p>

      {/* 1 ── why context windows aren't the answer ─────────────────────── */}

      <h2 id="why"><span className="sec-n">1.</span>Why context windows aren&apos;t the answer</h2>

      <p>
        Claude's window is one million tokens. That's the marketing. The
        reality is that you don't actually get the marketed window in practice.
      </p>

      <p>
        Independent benchmarks through 2026 show frontier 1M-token models
        drop roughly 25&ndash;60 percentage points of retrieval accuracy past
        200K tokens. Even Gemini's 10M window doesn't escape it; attention
        dilution shows up later, but it still shows up. Multi-turn coding
        sessions accumulate worse: each turn appends tool outputs, intermediate
        reasoning, and re-injected chunks until the model loses the thread on
        the larger plan. Then <span className="mono">/compact</span> happens,
        and most of what Claude learned in the session disappears.
      </p>

      <p>
        The agent-memory ecosystem has grown up next to this problem.{" "}
        <a href="https://github.com/mem0ai/mem0" target="_blank" rel="noreferrer">Mem0</a>,{" "}
        <a href="https://www.letta.com" target="_blank" rel="noreferrer">Letta</a>,{" "}
        <a href="https://getzep.com" target="_blank" rel="noreferrer">Zep</a>. They target
        chat memory: facts about the user, prior topics, state changes. None
        of them expose primitives appropriate to source code. None of them are
        verifiable in a way you'd defend in a postmortem.
      </p>

      {/* 2 ── the idea ──────────────────────────────────────────────────── */}

      <h2 id="idea"><span className="sec-n">2.</span>The idea</h2>

      <p>
        In December 2025, three researchers at MIT &mdash; Alex Zhang, Tim
        Kraska, and Omar Khattab &mdash; published a paper called{" "}
        <em>
          <a href="https://arxiv.org/abs/2512.24601" target="_blank" rel="noreferrer">
            Recursive Language Models
          </a>
        </em>. The thesis: stop feeding long context to the model. Make the
        long context an environment the model examines through a REPL, with
        the option to recursively call itself over snippets. Their experiments
        achieved two orders of magnitude beyond the underlying model's context
        window on long-context tasks, while <em>improving</em> answer quality.
      </p>

      <p>
        The Zhang et al. paper is general-purpose: a REPL of{" "}
        <span className="mono">exec</span>, <span className="mono">find</span>,{" "}
        <span className="mono">summarize</span>. engram specializes it for
        coding agents, with five primitives chosen to match what a coding
        agent actually issues queries for.
      </p>

      {/* 3 ── the primitives ────────────────────────────────────────────── */}

      <h2 id="primitives"><span className="sec-n">3.</span>The primitives</h2>

      <dl className="primitives">
        <dt>grep</dt>
        <dd>
          Bounded regex search across the repo. Returns file&thinsp;:&thinsp;line&thinsp;:&thinsp;col
          with N lines of context. Skips <span className="mono">node_modules</span>,{" "}
          <span className="mono">.git</span>, <span className="mono">dist</span>,
          build directories. Caps at 50 hits. If you hit the cap, you narrow.
        </dd>

        <dt>read</dt>
        <dd>
          A bounded line range from a file. 1-indexed, inclusive, hard-capped
          at 400 lines per call. There is no flag to fetch the whole file.
          That's the discipline.
        </dd>

        <dt>ast</dt>
        <dd>
          Structural queries via the TypeScript compiler API: functions,
          classes, exports, imports, or the tightest node containing a given
          line&thinsp;:&thinsp;col. Works on <span className="mono">.ts</span>,{" "}
          <span className="mono">.tsx</span>, <span className="mono">.mts</span>,{" "}
          <span className="mono">.cts</span>, <span className="mono">.js</span>,{" "}
          <span className="mono">.jsx</span>, <span className="mono">.mjs</span>,{" "}
          <span className="mono">.cjs</span>.
        </dd>

        <dt>git</dt>
        <dd>
          Bounded views over log, blame, and diff. Runs via{" "}
          <span className="mono">spawn</span> with a fixed argv. No shell, no
          injection vector.
        </dd>

        <dt>recurse</dt>
        <dd>
          Emits an <span className="mono">ENGRAM-RECURSE-REQUEST</span>. The
          parent dispatches via Claude's Task subagent. The child returns one
          to three sentences, never a transcript, so the parent's context
          stays clean.
        </dd>
      </dl>

      <p>An example call, end to end:</p>

      <pre><code>{`$ engram ast src/auth.ts functions --human
{
  "primitive": "ast",
  "ok": true,
  "data": {
    "file": "src/auth.ts",
    "symbols": [
      { "name": "login",   "kind": "function", "line": 12, "exported": true  },
      { "name": "refresh", "kind": "function", "line": 38, "exported": true  },
      { "name": "verify",  "kind": "function", "line": 64, "exported": false }
    ]
  },
  "truncated": false,
  "bytes": 218,
  "durationMs": 5,
  "journalId": "8c4a3f1e-7b22-4d91-aaff-1c0e9d2c63f4"
}`}</code></pre>

      <p>
        Every primitive funnels through a single byte-budgeted runner. There
        is no path that skips the audit chain. Errors are journaled too, so
        silent failure isn't possible.
      </p>

      {/* 4 ── the journal ───────────────────────────────────────────────── */}

      <h2 id="journal"><span className="sec-n">4.</span>The journal</h2>

      <p>
        Every call appends one line to{" "}
        <span className="mono">.engram/journal.jsonl</span>: timestamp,
        primitive, args, a sha256 hash over key-sorted JSON, a bounded preview,
        duration, session id. Append-only. Local. Replayable. You can answer
        &ldquo;what did Claude see at 02:14?&rdquo; with a cryptographic
        receipt.
      </p>

      <pre className="quiet"><code>{`07:50:24.987  engram.ast      {"file":"src/auth.ts","query":...}    sha256:3a7b8c…
07:50:25.012  engram.grep     {"pattern":"login","glob":"src/..."}  sha256:38d807…
07:50:25.044  engram.read     {"file":"src/auth.ts","fromLine":40}  sha256:c9e1f0…
07:50:25.063  engram.git      {"mode":"blame","file":"src/..."}     sha256:71b3d2…
07:50:25.118  engram.recurse  {"prompt":"summarize refresh path"}   sha256:9adf4e…`}</code></pre>

      <p>
        It's a file. No daemon, no cloud, no vendor. You can{" "}
        <span className="mono">cat .engram/journal.jsonl | jq</span>{" "}
        from any terminal that has those two tools. Audit, replay, gitignore,
        delete, compress, ship to a partner during incident review &mdash;
        whatever a file allows.
      </p>

      {/* 5 ── where it fits ─────────────────────────────────────────────── */}

      <h2 id="fits"><span className="sec-n">5.</span>Where it fits</h2>

      <p>
        Codebase retrieval is solved. Cursor's index, Cody, Sourcegraph
        &mdash; they get you a fast retrieval surface over code. engram isn't
        that. engram is what the model uses <em>after</em> retrieval has
        handed it an entry point.
      </p>

      <p>
        Agent memory is a category. Mem0, Letta, Zep get you a queryable
        layer over your agent's chat history. They aren't specialized for
        code; engram is. They also aren't verifiable in the sense that you
        can prove, after the fact, exactly what the model saw at a given
        moment. engram is.
      </p>

      <p>
        The 2025 Recursive Language Model paradigm is, as far as I can tell,
        the first time anyone has drawn a clean line between access and
        ingestion in agent design. engram is the first specialized
        implementation of that paradigm for coding agents that I know of.
        If I've missed someone, please{" "}
        <a href={`${SITE_REPO}/issues`} target="_blank" rel="noreferrer">open an issue</a>
        {" "}&mdash; I'd genuinely like to know.
      </p>

      {/* 6 ── install ───────────────────────────────────────────────────── */}

      <h2 id="install"><span className="sec-n">6.</span>Install</h2>

      <p>Two commands.</p>

      <pre><code>{`$ git clone ${SITE_REPO} ~/.claude/plugins/engram

$ npm install -g engram`}</code></pre>

      <p>
        The first installs engram as a Claude Code plugin and gives you{" "}
        <span className="mono">/engram &lt;question&gt;</span>. The second
        installs it as a standalone CLI so you can call primitives directly
        from any shell.
      </p>

      <p>
        engram needs Node 22.6 or later. It ships TypeScript source directly
        via <span className="mono">--experimental-strip-types</span>; there
        is no build step.{" "}
        <span className="aside">
          (The one runtime dependency is the TypeScript compiler, which the{" "}
          <span className="mono">ast</span> primitive uses. Everything else is
          Node built-ins.)
        </span>
      </p>

      {/* 7 ── what's next ───────────────────────────────────────────────── */}

      <h2 id="next"><span className="sec-n">7.</span>What&apos;s next</h2>

      <p>
        This release ships two of the eight memory tiers I think a coding
        agent actually needs: the journal (L2) and the code-as-environment
        view (L4). The other six are on the roadmap, in roughly this order:
      </p>

      <dl className="roadmap">
        <dt>L7</dt><dd>decision lineage</dd><dd>why we chose X over Y, what we tried</dd>
        <dt>L6</dt><dd>tool log</dd><dd>build outputs, test results, errors</dd>
        <dt>L3</dt><dd>project state</dd><dd>pending TODOs, branch intent</dd>
        <dt>L5</dt><dd>org memory</dd><dd>patterns across all your repos</dd>
      </dl>

      <p>
        The full roadmap and the design contracts that govern each tier are
        in the{" "}
        <a href={`${SITE_REPO}/blob/main/docs/ARCHITECTURE.md`} target="_blank" rel="noreferrer">
          ARCHITECTURE.md
        </a>{" "}
        in the repo. The full positioning &mdash; with citations, evaluation
        methodology, and threat model &mdash; is in the{" "}
        <Link href="/paper">paper</Link>.
      </p>

      <p>
        If any of this is wrong, or if you have a use case the primitives
        don't cover, the GitHub issues are open.
      </p>
    </div>
  );
}
