/**
 * read — return a bounded line range from a file. Never returns whole files.
 *
 * The whole point of engram is that Claude programmatically navigates instead
 * of soaking in raw context. This primitive enforces that: you must specify
 * a line range, and the range is hard-capped to keep individual reads small.
 */

import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { run } from "../engine/runner.ts";
import type { EngramConfig, PrimitiveOutput, ReadArgs, ReadResult } from "../types.ts";

const MAX_LINES_PER_CALL = 400;

export async function read(
  args: ReadArgs,
  config: EngramConfig,
): Promise<PrimitiveOutput<ReadResult>> {
  return run({
    primitive: "read",
    args: args as unknown as Readonly<Record<string, unknown>>,
    config,
    task: () => {
      if (args.fromLine < 1 || args.toLine < args.fromLine) {
        throw new Error(
          `invalid line range fromLine=${args.fromLine} toLine=${args.toLine} (1-indexed, toLine >= fromLine)`,
        );
      }
      const requestedSpan = args.toLine - args.fromLine + 1;
      if (requestedSpan > MAX_LINES_PER_CALL) {
        throw new Error(
          `range of ${requestedSpan} lines exceeds per-call cap of ${MAX_LINES_PER_CALL}; narrow the slice`,
        );
      }
      const full = resolve(config.cwd, args.file);
      const stat = statSync(full);
      if (!stat.isFile()) {
        throw new Error(`not a file: ${args.file}`);
      }
      const raw = readFileSync(full, "utf8");
      const allLines = raw.split("\n");
      const totalLines = allLines.length;
      const fromIdx = Math.min(args.fromLine - 1, totalLines);
      const toIdx = Math.min(args.toLine, totalLines);
      const slice = allLines.slice(fromIdx, toIdx);
      const data: ReadResult = {
        file: args.file,
        fromLine: args.fromLine,
        toLine: args.toLine,
        totalLines,
        lines: slice,
      };
      return data;
    },
  });
}
