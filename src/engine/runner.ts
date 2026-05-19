/**
 * Primitive runner — wraps every primitive so:
 *   - args are validated
 *   - byte budget is enforced (truncation, not unbounded output)
 *   - duration is measured
 *   - the journal entry is written
 *   - the result is normalized into PrimitiveOutput<T>
 *
 * No primitive ever calls the journal directly. They return their raw shape;
 * the runner does the bookkeeping. This keeps each primitive small and
 * easy to test, and guarantees no path skips the audit chain.
 */

import { appendJournal } from "./journal.ts";
import type {
  EngramConfig,
  PrimitiveError,
  PrimitiveName,
  PrimitiveOutput,
  PrimitiveResult,
} from "../types.ts";

export interface RunInput<TArgs extends Readonly<Record<string, unknown>>, TData> {
  readonly primitive: PrimitiveName;
  readonly args: TArgs;
  readonly config: EngramConfig;
  readonly callerHint?: string;
  readonly task: () => Promise<TData> | TData;
}

export async function run<TArgs extends Readonly<Record<string, unknown>>, TData>(
  input: RunInput<TArgs, TData>,
): Promise<PrimitiveOutput<TData>> {
  const start = performance.now();
  try {
    const raw = await input.task();
    const { data, truncated, bytes } = enforceBudget(raw, input.config.maxResultBytes);
    const durationMs = Math.round(performance.now() - start);
    const entry = appendJournal(input.config.journalPath, {
      primitive: input.primitive,
      args: input.args,
      result: data,
      durationMs,
      cwd: input.config.cwd,
      sessionId: input.config.sessionId,
      ...(input.callerHint === undefined ? {} : { callerHint: input.callerHint }),
    });
    const ok: PrimitiveResult<TData> = {
      primitive: input.primitive,
      ok: true,
      data,
      truncated,
      bytes,
      durationMs,
      journalId: entry.id,
    };
    return ok;
  } catch (e) {
    const durationMs = Math.round(performance.now() - start);
    const msg = e instanceof Error ? e.message : String(e);
    const entry = appendJournal(input.config.journalPath, {
      primitive: input.primitive,
      args: input.args,
      result: { error: msg },
      durationMs,
      cwd: input.config.cwd,
      sessionId: input.config.sessionId,
      ...(input.callerHint === undefined ? {} : { callerHint: input.callerHint }),
    });
    const err: PrimitiveError = {
      primitive: input.primitive,
      ok: false,
      error: msg,
      journalId: entry.id,
    };
    return err;
  }
}

interface BudgetResult<T> {
  readonly data: T;
  readonly truncated: boolean;
  readonly bytes: number;
}

/**
 * Enforces a byte budget on the serialized result. If over budget, we
 * truncate string fields proportionally. For arrays we drop the tail.
 * The model gets a `truncated: true` signal so it knows to narrow its query.
 */
function enforceBudget<T>(raw: T, maxBytes: number): BudgetResult<T> {
  const json = JSON.stringify(raw);
  const bytes = Buffer.byteLength(json, "utf8");
  if (bytes <= maxBytes) {
    return { data: raw, truncated: false, bytes };
  }
  if (Array.isArray(raw)) {
    const arr = raw as unknown[];
    const keep = Math.max(1, Math.floor((arr.length * maxBytes) / bytes));
    const truncated = arr.slice(0, keep) as unknown as T;
    return { data: truncated, truncated: true, bytes: Buffer.byteLength(JSON.stringify(truncated), "utf8") };
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (Array.isArray(v)) {
        const keep = Math.max(1, Math.floor((v.length * maxBytes) / bytes));
        next[k] = v.slice(0, keep);
      } else if (typeof v === "string" && v.length > 4096) {
        next[k] = `${v.slice(0, 4096)}…(+${v.length - 4096}B)`;
      } else {
        next[k] = v;
      }
    }
    return {
      data: next as unknown as T,
      truncated: true,
      bytes: Buffer.byteLength(JSON.stringify(next), "utf8"),
    };
  }
  return { data: raw, truncated: false, bytes };
}
