/**
 * ast — structural queries over a TypeScript/JavaScript file using
 * the TypeScript compiler API (.ts/.tsx/.js/.jsx/.mjs/.cjs).
 *
 * Supported queries:
 *   - functions  → top-level function declarations, methods, arrow consts
 *   - classes    → class declarations + their methods
 *   - exports    → every exported name (named, default, re-export)
 *   - imports    → every import binding (default, named, namespace)
 *   - symbol-at  → resolve the symbol whose definition spans line/col
 *
 * Returns AstSymbol[] sliced to a bounded length. The compiler is invoked
 * with createSourceFile (no program / no type-checking) so it's fast and
 * single-file-safe — no tsconfig discovery, no node_modules traversal.
 */

import { readFileSync } from "node:fs";
import { extname, resolve } from "node:path";

import ts from "typescript";

import { run } from "../engine/runner.ts";
import type {
  AstArgs,
  AstResult,
  AstSymbol,
  EngramConfig,
  PrimitiveOutput,
} from "../types.ts";

const MAX_SYMBOLS = 200;

const SCRIPT_KIND_BY_EXT: Record<string, ts.ScriptKind> = {
  ".ts": ts.ScriptKind.TS,
  ".tsx": ts.ScriptKind.TSX,
  ".mts": ts.ScriptKind.TS,
  ".cts": ts.ScriptKind.TS,
  ".js": ts.ScriptKind.JS,
  ".jsx": ts.ScriptKind.JSX,
  ".mjs": ts.ScriptKind.JS,
  ".cjs": ts.ScriptKind.JS,
};

export async function ast(
  args: AstArgs,
  config: EngramConfig,
): Promise<PrimitiveOutput<AstResult>> {
  return run({
    primitive: "ast",
    args: args as unknown as Readonly<Record<string, unknown>>,
    config,
    task: () => {
      const full = resolve(config.cwd, args.file);
      const ext = extname(args.file).toLowerCase();
      const scriptKind = SCRIPT_KIND_BY_EXT[ext] ?? ts.ScriptKind.TS;
      const source = readFileSync(full, "utf8");
      const sf = ts.createSourceFile(args.file, source, ts.ScriptTarget.Latest, true, scriptKind);

      let symbols: AstSymbol[];
      switch (args.query.kind) {
        case "functions":
          symbols = collectFunctions(sf);
          break;
        case "classes":
          symbols = collectClasses(sf);
          break;
        case "exports":
          symbols = collectExports(sf);
          break;
        case "imports":
          symbols = collectImports(sf);
          break;
        case "symbol-at":
          symbols = symbolAt(sf, args.query.line, args.query.col);
          break;
      }
      const sliced = symbols.slice(0, MAX_SYMBOLS);
      const data: AstResult = {
        file: args.file,
        query: args.query,
        symbols: sliced,
      };
      return data;
    },
  });
}

function lineOf(sf: ts.SourceFile, pos: number): number {
  return sf.getLineAndCharacterOfPosition(pos).line + 1;
}

function isExported(node: ts.Node): boolean {
  const mods = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  if (!mods) return false;
  return mods.some(
    (m) => m.kind === ts.SyntaxKind.ExportKeyword || m.kind === ts.SyntaxKind.DefaultKeyword,
  );
}

function signatureOf(node: ts.SignatureDeclaration, sf: ts.SourceFile): string {
  const start = node.getStart(sf);
  const bodyStart = (node as ts.FunctionLikeDeclaration).body?.getStart(sf) ?? node.getEnd();
  const raw = sf.text.slice(start, Math.min(bodyStart, start + 240)).replace(/\s+/g, " ").trim();
  return raw.length > 200 ? `${raw.slice(0, 200)}…` : raw;
}

function collectFunctions(sf: ts.SourceFile): AstSymbol[] {
  const out: AstSymbol[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.name) {
      out.push({
        name: node.name.text,
        kind: "function",
        line: lineOf(sf, node.getStart(sf)),
        endLine: lineOf(sf, node.getEnd()),
        signature: signatureOf(node, sf),
        exported: isExported(node),
      });
    } else if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) {
      out.push({
        name: node.name.text,
        kind: "method",
        line: lineOf(sf, node.getStart(sf)),
        endLine: lineOf(sf, node.getEnd()),
        signature: signatureOf(node, sf),
      });
    } else if (ts.isVariableStatement(node)) {
      const exported = isExported(node);
      for (const decl of node.declarationList.declarations) {
        if (!decl.initializer) continue;
        if (
          ts.isArrowFunction(decl.initializer) ||
          ts.isFunctionExpression(decl.initializer)
        ) {
          if (ts.isIdentifier(decl.name)) {
            out.push({
              name: decl.name.text,
              kind: ts.isArrowFunction(decl.initializer) ? "arrow" : "function-expression",
              line: lineOf(sf, decl.getStart(sf)),
              endLine: lineOf(sf, decl.getEnd()),
              signature: signatureOf(decl.initializer, sf),
              exported,
            });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

function collectClasses(sf: ts.SourceFile): AstSymbol[] {
  const out: AstSymbol[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isClassDeclaration(node) && node.name) {
      out.push({
        name: node.name.text,
        kind: "class",
        line: lineOf(sf, node.getStart(sf)),
        endLine: lineOf(sf, node.getEnd()),
        exported: isExported(node),
      });
    } else if (ts.isInterfaceDeclaration(node)) {
      out.push({
        name: node.name.text,
        kind: "interface",
        line: lineOf(sf, node.getStart(sf)),
        endLine: lineOf(sf, node.getEnd()),
        exported: isExported(node),
      });
    } else if (ts.isTypeAliasDeclaration(node)) {
      out.push({
        name: node.name.text,
        kind: "type",
        line: lineOf(sf, node.getStart(sf)),
        endLine: lineOf(sf, node.getEnd()),
        exported: isExported(node),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

function collectExports(sf: ts.SourceFile): AstSymbol[] {
  const out: AstSymbol[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isExportDeclaration(node)) {
      const clause = node.exportClause;
      if (clause && ts.isNamedExports(clause)) {
        for (const spec of clause.elements) {
          out.push({
            name: spec.name.text,
            kind: "export",
            line: lineOf(sf, spec.getStart(sf)),
            endLine: lineOf(sf, spec.getEnd()),
            exported: true,
          });
        }
      } else if (clause && ts.isNamespaceExport(clause)) {
        out.push({
          name: clause.name.text,
          kind: "namespace-export",
          line: lineOf(sf, clause.getStart(sf)),
          endLine: lineOf(sf, clause.getEnd()),
          exported: true,
        });
      }
    } else if (ts.isExportAssignment(node)) {
      out.push({
        name: "default",
        kind: "export-default",
        line: lineOf(sf, node.getStart(sf)),
        endLine: lineOf(sf, node.getEnd()),
        exported: true,
      });
    } else if (isExported(node)) {
      const name = nodeName(node);
      if (name !== null) {
        out.push({
          name,
          kind: ts.SyntaxKind[node.kind] ?? "export",
          line: lineOf(sf, node.getStart(sf)),
          endLine: lineOf(sf, node.getEnd()),
          exported: true,
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

function collectImports(sf: ts.SourceFile): AstSymbol[] {
  const out: AstSymbol[] = [];
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt)) continue;
    const moduleSpec = stmt.moduleSpecifier;
    const module = ts.isStringLiteral(moduleSpec) ? moduleSpec.text : "";
    const line = lineOf(sf, stmt.getStart(sf));
    const endLine = lineOf(sf, stmt.getEnd());
    const clause = stmt.importClause;
    if (!clause) {
      out.push({ name: module, kind: "side-effect-import", line, endLine });
      continue;
    }
    if (clause.name) {
      out.push({ name: `${clause.name.text} (default from ${module})`, kind: "import-default", line, endLine });
    }
    const named = clause.namedBindings;
    if (named && ts.isNamespaceImport(named)) {
      out.push({ name: `* as ${named.name.text} from ${module}`, kind: "import-namespace", line, endLine });
    } else if (named && ts.isNamedImports(named)) {
      for (const spec of named.elements) {
        out.push({
          name: `${spec.name.text} from ${module}`,
          kind: "import-named",
          line: lineOf(sf, spec.getStart(sf)),
          endLine: lineOf(sf, spec.getEnd()),
        });
      }
    }
  }
  return out;
}

function symbolAt(sf: ts.SourceFile, line: number, col: number): AstSymbol[] {
  const targetPos = sf.getPositionOfLineAndCharacter(Math.max(0, line - 1), Math.max(0, col - 1));
  let best: AstSymbol | null = null;
  let bestSpan = Number.POSITIVE_INFINITY;
  const visit = (node: ts.Node): void => {
    const start = node.getStart(sf);
    const end = node.getEnd();
    if (targetPos < start || targetPos > end) return;
    const span = end - start;
    const candidate = describe(node, sf);
    if (candidate && span < bestSpan) {
      best = candidate;
      bestSpan = span;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return best === null ? [] : [best];
}

function describe(node: ts.Node, sf: ts.SourceFile): AstSymbol | null {
  const name = nodeName(node);
  if (name === null) return null;
  return {
    name,
    kind: ts.SyntaxKind[node.kind] ?? "node",
    line: lineOf(sf, node.getStart(sf)),
    endLine: lineOf(sf, node.getEnd()),
  };
}

function nodeName(node: ts.Node): string | null {
  if (
    (ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isEnumDeclaration(node)) &&
    node.name
  ) {
    return node.name.text;
  }
  if (ts.isVariableStatement(node)) {
    const first = node.declarationList.declarations[0];
    if (first && ts.isIdentifier(first.name)) return first.name.text;
  }
  if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) return node.name.text;
  return null;
}
