import { readFileSync } from "node:fs";
import { join } from "node:path";

import { SITE_REPO, SITE_AUTHOR } from "../seo-config";

export const metadata = {
  title: "engram: A Recursive Language Model Engine for Coding Agents",
  description:
    "The research paper positioning engram in the 2026 long-context landscape — design contracts, evaluation methodology, threat model, and the 8-tier memory hierarchy.",
};

// Read the paper from the repo's docs/ at build time. The file lives outside
// app/, so we resolve it relative to cwd (the website root).
function loadPaper() {
  try {
    const path = join(process.cwd(), "..", "docs", "paper", "engram.md");
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

export default function PaperPage() {
  const md = loadPaper();
  return (
    <main className="section">
      <div className="wrap-narrow">
        <span className="eyebrow">research note</span>
        <div className="prose">
          {md
            ? <Markdown source={md} />
            : <FallbackNotice />}
          <hr />
          <p style={{ color: "var(--fg-3)" }}>
            Source markdown:{" "}
            <a href={`${SITE_REPO}/blob/main/docs/paper/engram.md`} target="_blank" rel="noreferrer">
              docs/paper/engram.md
            </a>{" "}
            · by <a href={SITE_AUTHOR.url} target="_blank" rel="noreferrer">{SITE_AUTHOR.name}</a>.
          </p>
        </div>
      </div>
    </main>
  );
}

function FallbackNotice() {
  return (
    <>
      <h1>Paper not built into this deploy</h1>
      <p>
        The paper source lives in the engram repo at{" "}
        <a href={`${SITE_REPO}/blob/main/docs/paper/engram.md`} target="_blank" rel="noreferrer">
          docs/paper/engram.md
        </a>
        . Read it there.
      </p>
    </>
  );
}

/**
 * Tiny, dependency-free markdown renderer. Handles the subset the engram
 * paper uses: headings (#–###), paragraphs, links, code (inline + fenced),
 * bullet/numbered lists, blockquotes, horizontal rules, bold/italic, and
 * the BibTeX block. Not a general-purpose markdown engine.
 */
function Markdown({ source }) {
  const blocks = parseBlocks(source);
  return <>{blocks.map((b, i) => renderBlock(b, i))}</>;
}

function parseBlocks(src) {
  const lines = src.split("\n");
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const buf = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) {
        buf.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push({ kind: "code", lang, text: buf.join("\n") });
      continue;
    }

    if (/^#{1,3}\s/.test(line)) {
      const level = line.match(/^#+/)[0].length;
      blocks.push({ kind: "h", level, text: line.replace(/^#+\s/, "") });
      i += 1;
      continue;
    }

    if (line.trim() === "---") {
      blocks.push({ kind: "hr" });
      i += 1;
      continue;
    }

    if (line.startsWith("> ")) {
      const buf = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        buf.push(lines[i].slice(2));
        i += 1;
      }
      blocks.push({ kind: "blockquote", text: buf.join(" ") });
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i += 1;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    const buf = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() !== "" && !/^#{1,3}\s/.test(lines[i]) && !lines[i].startsWith("```") && !lines[i].startsWith("> ") && !/^\s*[-*]\s+/.test(lines[i]) && lines[i].trim() !== "---") {
      buf.push(lines[i]);
      i += 1;
    }
    blocks.push({ kind: "p", text: buf.join(" ") });
  }
  return blocks;
}

function renderBlock(b, key) {
  switch (b.kind) {
    case "h": {
      const Tag = `h${b.level}`;
      return <Tag key={key}>{renderInline(b.text)}</Tag>;
    }
    case "p":
      return <p key={key}>{renderInline(b.text)}</p>;
    case "ul":
      return <ul key={key}>{b.items.map((t, i) => <li key={i}>{renderInline(t)}</li>)}</ul>;
    case "ol":
      return <ol key={key}>{b.items.map((t, i) => <li key={i}>{renderInline(t)}</li>)}</ol>;
    case "blockquote":
      return <blockquote key={key}>{renderInline(b.text)}</blockquote>;
    case "code":
      return (
        <pre key={key}>
          <code>{b.text}</code>
        </pre>
      );
    case "hr":
      return <hr key={key} />;
    default:
      return null;
  }
}

function renderInline(text) {
  // Order matters: code first (so we don't process ** inside backticks), then
  // links, then bold, then italic.
  const parts = [];
  let rest = text;
  let key = 0;

  while (rest.length > 0) {
    const codeM = rest.match(/`([^`]+)`/);
    const linkM = rest.match(/\[([^\]]+)\]\(([^)]+)\)/);
    const boldM = rest.match(/\*\*([^*]+)\*\*/);
    const itM   = rest.match(/(?<!\*)\*([^*]+)\*(?!\*)/);

    const candidates = [codeM, linkM, boldM, itM].filter(Boolean);
    if (candidates.length === 0) {
      parts.push(rest);
      break;
    }
    const next = candidates.reduce((acc, m) => (m.index < acc.index ? m : acc));

    if (next.index > 0) parts.push(rest.slice(0, next.index));

    if (next === codeM) {
      parts.push(<code key={key++}>{next[1]}</code>);
    } else if (next === linkM) {
      const isExternal = /^https?:/.test(next[2]);
      parts.push(
        <a key={key++} href={next[2]} target={isExternal ? "_blank" : undefined} rel={isExternal ? "noreferrer" : undefined}>
          {next[1]}
        </a>,
      );
    } else if (next === boldM) {
      parts.push(<strong key={key++}>{next[1]}</strong>);
    } else if (next === itM) {
      parts.push(<em key={key++}>{next[1]}</em>);
    }

    rest = rest.slice(next.index + next[0].length);
  }
  return parts;
}
