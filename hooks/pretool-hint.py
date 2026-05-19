#!/usr/bin/env python3
"""
engram PreToolUse hook — advisory.

Watches for Bash / Read calls that engram could journal, and prints a
single-line hint to stderr. Never blocks: the model still gets the tool
result and the hint together, and decides on the next turn whether to
re-route through engram.

The hint is the entire mechanism — engram cannot force Claude to use it,
but a visible nudge at the right moment is enough to keep the audit chain
honest in most sessions.

Hook protocol (Claude Code): the tool-call payload is delivered as JSON
on stdin with shape:
  { "tool_name": "Bash" | "Read" | ..., "tool_input": { ... } }
Exit 0 = proceed; we never use the block path here.
"""
from __future__ import annotations

import json
import os
import re
import sys


def load_payload() -> dict:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        return json.loads(raw)
    except Exception:
        return {}


# Patterns where engram has a better, journaled alternative.
BASH_PATTERNS = [
    # tool         pattern (compiled)                                       suggestion
    ("grep",       re.compile(r"(?:^|[\s;&|])(grep|rg|ack)\s"),             "engram.grep journals this with file:line:col + context. Try: engram grep \"<pattern>\" --cwd \"$PWD\""),
    ("git-log",    re.compile(r"(?:^|[\s;&|])git\s+log\b"),                 "engram.git log journals this. Try: engram git log --cwd \"$PWD\" [--file <f>] [--max N]"),
    ("git-blame",  re.compile(r"(?:^|[\s;&|])git\s+blame\b"),               "engram.git blame journals authorship per line. Try: engram git blame --file <f> --cwd \"$PWD\""),
    ("git-diff",   re.compile(r"(?:^|[\s;&|])git\s+diff\b"),                "engram.git diff journals bounded diff output. Try: engram git diff [--ref <r>] --cwd \"$PWD\""),
    ("cat-source", re.compile(r"(?:^|[\s;&|])(cat|less|more)\s+\S+\.(?:ts|tsx|js|jsx|mts|cts|mjs|cjs|py|rs|go|java|md|css)\b"),
                                                                            "engram.read bounds slices to <=400 lines and journals them. Try: engram read <file> <from> <to> --cwd \"$PWD\""),
    ("find-name",  re.compile(r"(?:^|[\s;&|])find\s+\S+\s+-name\b"),        "If you're looking for matches inside files, engram.grep + --glob is journaled and bounded."),
]

READ_LARGE_THRESHOLD = 200  # lines


def bash_hint(cmd: str) -> str | None:
    if not cmd:
        return None
    # Suppress nudging on the engram CLI itself.
    if re.search(r"(?:^|[\s;&|])engram\s", cmd):
        return None
    for _name, pat, msg in BASH_PATTERNS:
        if pat.search(cmd):
            return msg
    return None


def read_hint(tool_input: dict) -> str | None:
    file_path = tool_input.get("file_path") or ""
    if not file_path or not os.path.isfile(file_path):
        return None
    # If the model already passed an offset+limit, it's slicing — no hint.
    if "offset" in tool_input and tool_input.get("offset") is not None:
        return None
    if "limit" in tool_input and tool_input.get("limit") is not None:
        return None
    try:
        with open(file_path, "rb") as f:
            line_count = sum(1 for _ in f)
    except Exception:
        return None
    if line_count <= READ_LARGE_THRESHOLD:
        return None
    return (
        f"This file is {line_count} lines. engram.read bounds slices to 400 lines and journals them. "
        f"Try: engram read {file_path} <from> <to> --cwd \"$PWD\""
    )


def main() -> int:
    payload = load_payload()
    tool = payload.get("tool_name") or payload.get("tool") or ""
    tool_input = payload.get("tool_input") or payload.get("input") or {}

    hint: str | None = None
    if tool == "Bash":
        hint = bash_hint(tool_input.get("command", ""))
    elif tool == "Read":
        hint = read_hint(tool_input)

    if hint:
        print(f"engram hint: {hint}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
