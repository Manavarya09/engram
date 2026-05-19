/**
 * recurse — emit a structured delegation request the parent Claude consumes.
 *
 * RLM in its purest form would have engram itself spawn a sub-LLM. In v0 we
 * use Claude Code's native Task subagent primitive instead — it's already
 * there, it's already auditable, and it avoids hard-coding an API key path.
 *
 * The flow:
 *   1. Parent Claude (running /engram) decides a long snippet warrants
 *      isolation. It calls `engram recurse` with the prompt + snippets.
 *   2. This primitive validates depth + snippet budget, journals the call,
 *      and returns a "delegation-request" record.
 *   3. The /engram command instructions tell Claude: "if you see a
 *      delegation-request, dispatch it via the Task tool and feed only the
 *      sub-agent's conclusion back into your own context."
 *
 * Depth-guard: ENGRAM_RECURSE_DEPTH env var is checked + incremented.
 * Snippet count is hard-capped. Total snippet bytes are budgeted.
 */

import { randomUUID } from "node:crypto";

import { run } from "../engine/runner.ts";
import type {
  EngramConfig,
  PrimitiveOutput,
  RecurseArgs,
  RecurseResult,
  RecurseSnippet,
} from "../types.ts";

const MAX_SNIPPETS = 16;
const MAX_SNIPPET_BYTES = 24 * 1024;
const MAX_PROMPT_LEN = 2000;

export async function recurse(
  args: RecurseArgs,
  config: EngramConfig,
): Promise<PrimitiveOutput<RecurseResult>> {
  return run({
    primitive: "recurse",
    args: {
      prompt: args.prompt,
      snippetCount: args.snippets.length,
      maxTokens: args.maxTokens ?? null,
    },
    config,
    task: () => {
      if (config.recurseDepth >= config.maxRecurseDepth) {
        throw new Error(
          `recurse depth ${config.recurseDepth} >= max ${config.maxRecurseDepth}; refuse infinite descent`,
        );
      }
      if (args.prompt.length === 0) {
        throw new Error("recurse requires a non-empty prompt");
      }
      if (args.prompt.length > MAX_PROMPT_LEN) {
        throw new Error(`prompt exceeds ${MAX_PROMPT_LEN} chars`);
      }
      if (args.snippets.length === 0) {
        throw new Error("recurse requires at least one snippet (otherwise just answer directly)");
      }
      if (args.snippets.length > MAX_SNIPPETS) {
        throw new Error(`snippet count ${args.snippets.length} exceeds cap ${MAX_SNIPPETS}`);
      }
      enforceSnippetBudget(args.snippets);

      const recurseId = randomUUID();
      const result: RecurseResult = {
        prompt: args.prompt,
        conclusion: buildDelegationDirective(recurseId, args.prompt, args.snippets, config),
        snippetCount: args.snippets.length,
        recurseId,
        mode: "delegation-request",
      };
      return result;
    },
  });
}

function enforceSnippetBudget(snippets: readonly RecurseSnippet[]): void {
  let total = 0;
  for (const s of snippets) {
    total += Buffer.byteLength(s.content, "utf8");
  }
  if (total > MAX_SNIPPET_BYTES) {
    throw new Error(
      `snippets total ${total}B exceeds ${MAX_SNIPPET_BYTES}B; chunk further or summarize before recursing`,
    );
  }
}

function buildDelegationDirective(
  recurseId: string,
  prompt: string,
  snippets: readonly RecurseSnippet[],
  config: EngramConfig,
): string {
  const nextDepth = config.recurseDepth + 1;
  const sources = snippets.map((s) => `- ${s.source}`).join("\n");
  return [
    `ENGRAM-RECURSE-REQUEST id=${recurseId} depth=${nextDepth}/${config.maxRecurseDepth}`,
    "",
    "Dispatch this via the Task subagent tool. The subagent should:",
    `  1. Receive ONLY the prompt + snippets below (do not load other files)`,
    `  2. Set ENGRAM_RECURSE_DEPTH=${nextDepth} when invoking engram primitives`,
    `  3. Return a single short conclusion (1-3 sentences) — not a transcript`,
    "",
    "Sub-prompt:",
    prompt,
    "",
    "Snippets:",
    sources,
  ].join("\n");
}
