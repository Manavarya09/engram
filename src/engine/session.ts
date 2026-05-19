/**
 * Session + config bootstrap.
 *
 * Each engram process derives an EngramConfig from environment + cwd.
 * The session id is a UUID per process unless ENGRAM_SESSION_ID is set
 * (Claude Code slash commands can pass a stable id so multiple primitive
 * calls within one user turn share a session).
 */

import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import type { EngramConfig } from "../types.js";
import { DEFAULT_CONFIG } from "../types.js";

export function resolveConfig(overrides: Partial<EngramConfig> = {}): EngramConfig {
  const cwd = overrides.cwd ?? process.cwd();
  const journalPath =
    overrides.journalPath ?? process.env["ENGRAM_JOURNAL"] ?? resolve(cwd, ".engram", "journal.jsonl");
  const sessionId = overrides.sessionId ?? process.env["ENGRAM_SESSION_ID"] ?? randomUUID();

  return {
    ...DEFAULT_CONFIG,
    cwd,
    journalPath,
    sessionId,
    ...overrides,
  };
}
