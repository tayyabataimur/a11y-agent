import { z } from "zod";
import { readdirSync, statSync } from "fs";
import { join } from "path";
import { runAxeAudit, type Violation } from "../lib/axe-runner.js";

export const auditRepoSchema = z.object({
  root: z
    .string()
    .describe("Absolute path to the project root directory to scan."),
  baseUrl: z
    .string()
    .optional()
    .describe(
      "Base URL of a running dev server (e.g. http://localhost:3000). Required for auditing React/TSX components — they must be rendered to produce meaningful results. If omitted, only static .html files in the repo are audited."
    ),
  maxFiles: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Maximum number of files to audit in one pass (default: 20)."),
});

export type AuditRepoInput = z.infer<typeof auditRepoSchema>;

export interface FileViolationSummary {
  file: string;
  violationCount: number;
  criticalCount: number;
  seriousCount: number;
  violations: Array<{
    id: string;
    impact: Violation["impact"];
    description: string;
    wcag: string[];
    nodeCount: number;
  }>;
}

export interface RepoAuditResult {
  root: string;
  filesScanned: number;
  totalViolations: number;
  criticalViolations: number;
  topViolations: Array<{ id: string; count: number; impact: string }>;
  fileResults: FileViolationSummary[];
  timestamp: string;
}

// For live auditing, derive page paths from file paths by stripping root and extension.
// e.g. /project/src/app/about/page.tsx → /about
function fileToRoute(filePath: string, root: string): string {
  let route = filePath
    .replace(root, "")
    .replace(/\\/g, "/")
    .replace(/\.(tsx|jsx|ts|js)$/, "")
    // Next.js: strip /app, /pages prefixes and /page, /index suffixes
    .replace(/^\/(app|pages)/, "")
    .replace(/\/(page|index)$/, "")
    || "/";
  return route.startsWith("/") ? route : `/${route}`;
}

function walkDir(dir: string, extensions: string[], maxFiles: number): string[] {
  const results: string[] = [];

  function walk(current: string): void {
    if (results.length >= maxFiles) return;

    const entries = readdirSync(current);
    for (const entry of entries) {
      if (results.length >= maxFiles) break;

      const fullPath = join(current, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        if (entry === "node_modules" || entry === ".git" || entry === "dist" || entry === ".next") {
          continue;
        }
        walk(fullPath);
      } else if (extensions.some((ext) => entry.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results;
}


export async function auditRepo(input: AuditRepoInput): Promise<RepoAuditResult> {
  // Without a baseUrl, only audit static HTML files — TSX/JSX must be rendered to be meaningful
  const extensions = input.baseUrl ? [".tsx", ".jsx", ".html"] : [".html"];
  const files = walkDir(input.root, extensions, input.maxFiles);

  const fileResults: FileViolationSummary[] = [];
  const violationCounts: Record<string, { count: number; impact: string }> = {};

  for (const file of files) {
    try {
      const target = input.baseUrl
        ? `${input.baseUrl.replace(/\/$/, "")}${fileToRoute(file, input.root)}`
        : `file://${file}`;

      const result = await runAxeAudit(target);

      const summary: FileViolationSummary = {
        file,
        violationCount: result.violations.length,
        criticalCount: result.violations.filter((v) => v.impact === "critical").length,
        seriousCount: result.violations.filter((v) => v.impact === "serious").length,
        violations: result.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          wcag: v.wcag,
          nodeCount: v.nodes.length,
        })),
      };

      fileResults.push(summary);

      for (const v of result.violations) {
        if (!violationCounts[v.id]) {
          violationCounts[v.id] = { count: 0, impact: v.impact };
        }
        violationCounts[v.id].count += v.nodes.length;
      }
    } catch {
      // Skip files that fail to audit (e.g. components requiring runtime context)
    }
  }

  // Sort files by severity
  fileResults.sort((a, b) => {
    const aScore = a.criticalCount * 10 + a.seriousCount * 3 + a.violationCount;
    const bScore = b.criticalCount * 10 + b.seriousCount * 3 + b.violationCount;
    return bScore - aScore;
  });

  const topViolations = Object.entries(violationCounts)
    .map(([id, { count, impact }]) => ({ id, count, impact }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const totalViolations = fileResults.reduce((sum, f) => sum + f.violationCount, 0);
  const criticalViolations = fileResults.reduce((sum, f) => sum + f.criticalCount, 0);

  return {
    root: input.root,
    filesScanned: files.length,
    totalViolations,
    criticalViolations,
    topViolations,
    fileResults,
    timestamp: new Date().toISOString(),
  };
}
