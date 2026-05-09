import { chromium, type Browser, type Page } from "playwright";
import type { AxeResults, Result, NodeResult } from "axe-core";
import { readFileSync } from "fs";
import { createRequire } from "module";

export interface Violation {
  id: string;
  impact: "minor" | "moderate" | "serious" | "critical";
  description: string;
  help: string;
  helpUrl: string;
  wcag: string[];
  nodes: Array<{
    selector: string;
    html: string;
    failureSummary: string;
  }>;
}

export interface AuditResult {
  url: string;
  violations: Violation[];
  passes: number;
  incomplete: number;
  timestamp: string;
}

function extractWcagTags(result: Result): string[] {
  return (result.tags ?? [])
    .filter((tag) => tag.startsWith("wcag") || tag.startsWith("best-practice"))
    .map((tag) => tag.toUpperCase().replace("WCAG", "WCAG "));
}

function mapImpact(impact: string | null | undefined): Violation["impact"] {
  const valid = ["minor", "moderate", "serious", "critical"] as const;
  if (impact && valid.includes(impact as Violation["impact"])) {
    return impact as Violation["impact"];
  }
  return "moderate";
}

function mapNode(node: NodeResult): Violation["nodes"][number] {
  return {
    selector: node.target.join(", "),
    html: node.html,
    failureSummary: node.failureSummary ?? "",
  };
}

export async function runAxeAudit(target: string): Promise<AuditResult> {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();

    const isAbsoluteUrl =
      target.startsWith("http://") ||
      target.startsWith("https://") ||
      target.startsWith("file://") ||
      target.startsWith("data:");
    const url = isAbsoluteUrl ? target : `file://${target}`;

    await page.goto(url, { waitUntil: "networkidle" });

    // Inject axe-core from local node_modules — no CDN dependency, works offline
    const require = createRequire(import.meta.url);
    const axePath = require.resolve("axe-core");
    const axeSource = readFileSync(axePath, "utf-8");
    await page.addScriptTag({ content: axeSource });

    const results = await page.evaluate(async () => {
      // axe is available globally after the script tag injection
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await (globalThis as any).axe.run();
    }) as AxeResults;

    const violations: Violation[] = results.violations.map((v: Result) => ({
      id: v.id,
      impact: mapImpact(v.impact),
      description: v.description,
      help: v.help,
      helpUrl: v.helpUrl,
      wcag: extractWcagTags(v),
      nodes: v.nodes.map(mapNode),
    }));

    return {
      url,
      violations,
      passes: results.passes.length,
      incomplete: results.incomplete.length,
      timestamp: new Date().toISOString(),
    };
  } finally {
    await page?.close();
    await browser?.close();
  }
}
