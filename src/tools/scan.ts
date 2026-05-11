import { z } from "zod";
import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { runAxeAudit, type Violation } from "../lib/axe-runner.js";
import { authConfigSchema } from "../core/auth.js";

export const auditRepoSchema = z.object({
  root: z
    .string()
    .describe("Absolute path to the project root directory to scan."),
  baseUrl: z
    .string()
    .optional()
    .describe(
      "Base URL of a running dev server (e.g. http://localhost:3000). Required for auditing rendered framework routes like React, Next.js, Vue, or Svelte pages. If omitted, only static .html files in the repo are audited."
    ),
  maxFiles: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Maximum number of files to audit in one pass (default: 20)."),
  auth: authConfigSchema.optional(),
});

export type AuditRepoInput = z.infer<typeof auditRepoSchema>;

export interface SourceHint {
  file: string;
  reason: string;
  confidence: number;
}

export interface FileViolationDetail {
  id: string;
  impact: Violation["impact"];
  description: string;
  wcag: string[];
  nodeCount: number;
  selectors: string[];
  sourceHints: SourceHint[];
}

export interface FileViolationSummary {
  file: string;
  relativeFile: string;
  framework: string;
  route?: string;
  auditTarget: string;
  violationCount: number;
  criticalCount: number;
  seriousCount: number;
  sourceMappingConfidence: number;
  violations: FileViolationDetail[];
}

export interface RepoAuditResult {
  root: string;
  frameworks: string[];
  filesDiscovered: number;
  filesScanned: number;
  filesSkipped: number;
  totalViolations: number;
  criticalViolations: number;
  topViolations: Array<{ id: string; count: number; impact: string }>;
  fileResults: FileViolationSummary[];
  sourceMapping: {
    mappedViolations: number;
    totalViolationTypes: number;
    averageConfidence: number;
  };
  timestamp: string;
}

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  ".next",
  "coverage",
  "build",
  ".turbo",
  ".vercel",
  ".svelte-kit",
  "out",
]);

const STATIC_EXTENSIONS = [".html"];
const RENDERED_EXTENSIONS = [".html", ".tsx", ".jsx", ".vue", ".svelte", ".astro"];

interface RepoContext {
  root: string;
  files: string[];
  frameworks: string[];
}

function detectFrameworks(root: string): string[] {
  const frameworks = new Set<string>();

  const packageJsonPath = join(root, "package.json");
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
      if (deps.next) frameworks.add("nextjs");
      if (deps.react) frameworks.add("react");
      if (deps.vue) frameworks.add("vue");
      if (deps.svelte) frameworks.add("svelte");
      if (deps["@angular/core"]) frameworks.add("angular");
      if (deps.astro) frameworks.add("astro");
      if (deps.gatsby) frameworks.add("gatsby");
      if (deps.remix || deps["@remix-run/react"]) frameworks.add("remix");
    } catch {
      // Ignore invalid package.json for now
    }
  }

  if (existsSync(join(root, "next.config.js")) || existsSync(join(root, "next.config.mjs"))) frameworks.add("nextjs");
  if (existsSync(join(root, "svelte.config.js")) || existsSync(join(root, "svelte.config.ts"))) frameworks.add("svelte");
  if (existsSync(join(root, "angular.json"))) frameworks.add("angular");
  if (existsSync(join(root, "astro.config.mjs")) || existsSync(join(root, "astro.config.ts"))) frameworks.add("astro");
  if (existsSync(join(root, "vite.config.ts")) || existsSync(join(root, "vite.config.js"))) frameworks.add("vite");

  return frameworks.size > 0 ? [...frameworks] : ["html"];
}

function inferFileFramework(file: string, repoFrameworks: string[]): string {
  if (file.endsWith(".html")) return "html";
  if (file.endsWith(".vue")) return "vue";
  if (file.endsWith(".svelte")) return "svelte";
  if (file.endsWith(".astro")) return "astro";
  if (file.endsWith(".tsx") || file.endsWith(".jsx")) {
    if (repoFrameworks.includes("nextjs")) return "nextjs";
    if (repoFrameworks.includes("gatsby")) return "gatsby";
    if (repoFrameworks.includes("remix")) return "remix";
    return "react";
  }
  return repoFrameworks[0] ?? "unknown";
}

function walkRepo(dir: string, extensions: string[], maxFiles: number): string[] {
  const results: string[] = [];

  function walk(current: string): void {
    if (results.length >= maxFiles) return;

    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (results.length >= maxFiles) break;
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(join(current, entry.name));
        continue;
      }
      if (extensions.some((ext) => entry.name.endsWith(ext))) {
        results.push(join(current, entry.name));
      }
    }
  }

  walk(dir);
  return results;
}

function fileToRoute(filePath: string, root: string): string {
  const relativePath = relative(root, filePath).replace(/\\/g, "/");

  if (relativePath === "index.html") return "/";

  let route = relativePath
    .replace(/^(src\/)?(app|pages)\//, "")
    .replace(/^(src\/)?routes\//, "")
    .replace(/\.(tsx|jsx|vue|svelte|astro|html)$/, "")
    .replace(/\/(page|index)$/, "")
    .replace(/^index$/, "")
    .replace(/\/index$/, "")
    .replace(/\[(\.\.\.)?[^/]+\]/g, ":param");

  if (!route) return "/";
  if (!route.startsWith("/")) route = `/${route}`;
  return route;
}

function buildAuditTarget(file: string, root: string, baseUrl?: string): string {
  if (!baseUrl) return `file://${file}`;
  return `${baseUrl.replace(/\/$/, "")}${fileToRoute(file, root)}`;
}

function scoreFileSeverity(file: FileViolationSummary): number {
  return file.criticalCount * 10 + file.seriousCount * 3 + file.violationCount;
}

function findTextFragments(html: string): string[] {
  return [...html.matchAll(/>([^<]{3,80})</g)]
    .map((match) => match[1].trim())
    .filter((text) => text.length >= 3)
    .slice(0, 3);
}

function selectorTokens(selector: string): string[] {
  return selector
    .split(/[^A-Za-z0-9_-]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3)
    .slice(0, 6);
}

function buildSourceHints(file: string, root: string, framework: string, route: string | undefined, violation: Violation, allFiles: string[]): SourceHint[] {
  const hints: SourceHint[] = [];
  const relativeFile = relative(root, file) || file;

  hints.push({
    file,
    reason: framework === "html"
      ? `Static HTML file directly audited for this violation (${relativeFile}).`
      : `Likely source file because the audited route maps to this file (${relativeFile}).`,
    confidence: framework === "html" ? 0.98 : 0.86,
  });

  const searchTokens = new Set<string>();
  for (const node of violation.nodes.slice(0, 3)) {
    for (const token of selectorTokens(node.selector)) searchTokens.add(token);
    for (const text of findTextFragments(node.html)) searchTokens.add(text);
  }

  if (route && route !== "/") {
    const routeParts = route.split("/").filter(Boolean).slice(-2);
    for (const part of routeParts) {
      if (part && !part.startsWith(":")) searchTokens.add(part);
    }
  }

  const candidateHints: SourceHint[] = [];
  for (const candidate of allFiles) {
    if (candidate === file) continue;
    if (candidateHints.length >= 3) break;
    try {
      const contents = readFileSync(candidate, "utf-8");
      const matchedToken = [...searchTokens].find((token) => contents.includes(token));
      if (!matchedToken) continue;
      candidateHints.push({
        file: candidate,
        reason: `Contains selector/text clue \"${matchedToken}\" from the failing DOM node.`,
        confidence: 0.52,
      });
    } catch {
      // Ignore unreadable files
    }
  }

  const deduped = new Map<string, SourceHint>();
  for (const hint of [...hints, ...candidateHints]) {
    const existing = deduped.get(hint.file);
    if (!existing || hint.confidence > existing.confidence) deduped.set(hint.file, hint);
  }

  return [...deduped.values()].sort((a, b) => b.confidence - a.confidence).slice(0, 4);
}

function createRepoContext(root: string, maxFiles: number, baseUrl?: string): RepoContext {
  const normalizedRoot = resolve(root);
  const frameworks = detectFrameworks(normalizedRoot);
  const files = walkRepo(
    normalizedRoot,
    baseUrl ? RENDERED_EXTENSIONS : STATIC_EXTENSIONS,
    maxFiles
  );

  return {
    root: normalizedRoot,
    files,
    frameworks,
  };
}

export async function auditRepo(input: AuditRepoInput): Promise<RepoAuditResult> {
  const context = createRepoContext(input.root, input.maxFiles, input.baseUrl);
  const fileResults: FileViolationSummary[] = [];
  const violationCounts: Record<string, { count: number; impact: string }> = {};
  let filesSkipped = 0;
  let mappedViolations = 0;
  let totalViolationTypes = 0;
  let totalConfidence = 0;

  for (const file of context.files) {
    const framework = inferFileFramework(file, context.frameworks);
    const route = input.baseUrl ? fileToRoute(file, context.root) : undefined;
    const auditTarget = buildAuditTarget(file, context.root, input.baseUrl);

    try {
      const result = await runAxeAudit(auditTarget, input.auth);
      const violations: FileViolationDetail[] = result.violations.map((v) => {
        const sourceHints = buildSourceHints(file, context.root, framework, route, v, context.files);
        if (sourceHints.length > 0) {
          mappedViolations += 1;
          totalConfidence += sourceHints[0]?.confidence ?? 0;
        }
        totalViolationTypes += 1;

        return {
          id: v.id,
          impact: v.impact,
          description: v.description,
          wcag: v.wcag,
          nodeCount: v.nodes.length,
          selectors: v.nodes.map((node) => node.selector).slice(0, 5),
          sourceHints,
        };
      });

      const summary: FileViolationSummary = {
        file,
        relativeFile: relative(context.root, file) || file,
        framework,
        ...(route ? { route } : {}),
        auditTarget,
        violationCount: result.violations.length,
        criticalCount: result.violations.filter((v) => v.impact === "critical").length,
        seriousCount: result.violations.filter((v) => v.impact === "serious").length,
        sourceMappingConfidence: violations.length > 0
          ? Number((violations.reduce((sum, violation) => sum + (violation.sourceHints[0]?.confidence ?? 0), 0) / violations.length).toFixed(2))
          : 0,
        violations,
      };

      fileResults.push(summary);

      for (const v of result.violations) {
        if (!violationCounts[v.id]) {
          violationCounts[v.id] = { count: 0, impact: v.impact };
        }
        violationCounts[v.id].count += v.nodes.length;
      }
    } catch {
      filesSkipped += 1;
    }
  }

  fileResults.sort((a, b) => scoreFileSeverity(b) - scoreFileSeverity(a));

  const topViolations = Object.entries(violationCounts)
    .map(([id, { count, impact }]) => ({ id, count, impact }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const totalViolations = fileResults.reduce((sum, f) => sum + f.violationCount, 0);
  const criticalViolations = fileResults.reduce((sum, f) => sum + f.criticalCount, 0);

  return {
    root: context.root,
    frameworks: context.frameworks,
    filesDiscovered: context.files.length,
    filesScanned: fileResults.length,
    filesSkipped,
    totalViolations,
    criticalViolations,
    topViolations,
    fileResults,
    sourceMapping: {
      mappedViolations,
      totalViolationTypes,
      averageConfidence: totalViolationTypes > 0 ? Number((totalConfidence / totalViolationTypes).toFixed(2)) : 0,
    },
    timestamp: new Date().toISOString(),
  };
}
