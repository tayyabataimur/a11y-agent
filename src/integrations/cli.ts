import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { evaluateUrl } from "../core/evaluate-service.js";
import { verifyRemediation } from "../core/verify-service.js";
import type { AuthConfig } from "../core/auth.js";
import { toMarkdownReport } from "./export/markdown.js";
import { toJsonReport, type ReportFormat, writeReport } from "./export/json.js";
import { auditRepo } from "../tools/scan.js";
import { crawlSite } from "../tools/crawl.js";

function printHelp(): void {
  process.stdout.write(`A11yAgent CLI\n\nUsage:\n  a11y-agent audit <url> [--json|--markdown] [--output <file>] [auth flags]\n  a11y-agent audit:file <path> [--json|--markdown] [--output <file>] [auth flags]\n  a11y-agent audit:repo <path> [--base-url <url>] [--max-files <n>] [--json|--markdown] [--output <file>] [auth flags]\n  a11y-agent crawl --url <url> [--max-pages <n>] [--json|--markdown] [--output <file>] [auth flags]\n  a11y-agent crawl --sitemap <url> [--max-pages <n>] [--json|--markdown] [--output <file>] [auth flags]\n  a11y-agent verify <source-path> --url <url> [--json|--markdown] [--output <file>] [auth flags]\n  a11y-agent --help\n\nAuth flags:\n  --storage-state <file>\n  --basic-auth-user <user> --basic-auth-pass <pass>\n  --header "Name: Value"   (repeatable)\n\nThreshold flags:\n  --fail-on <critical|serious|moderate|minor>\n  --max-violations <n>\n  --baseline <report.json>\n\nNotes:\n  - No arguments starts MCP server mode\n  - Crawl currently supports same-origin discovery and sitemap seeding\n`);
}

function readFlagValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function readFlagValues(args: string[], name: string): string[] {
  const values: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === name && args[i + 1]) values.push(args[i + 1]);
  }
  return values;
}

function normalizeFileTarget(filePath: string): string {
  const absolutePath = resolve(filePath);
  const stat = statSync(absolutePath);
  if (!stat.isFile()) {
    throw new Error(`Not a file: ${absolutePath}`);
  }
  return `file://${absolutePath}`;
}

function normalizeExistingPath(pathValue: string): string {
  const absolutePath = resolve(pathValue);
  statSync(absolutePath);
  return absolutePath;
}

function detectFormat(args: string[], outputPath?: string): ReportFormat {
  if (hasFlag(args, "--markdown")) return "markdown";
  if (hasFlag(args, "--json")) return "json";
  if (outputPath?.toLowerCase().endsWith(".md")) return "markdown";
  return "json";
}

function renderForStdout(result: unknown, format: ReportFormat, structured: boolean, summary?: string): string {
  if (format === "markdown") {
    return toMarkdownReport(result);
  }
  if (!structured && summary) {
    return `${summary}\n`;
  }
  return toJsonReport(result);
}

function emitResult(result: unknown, format: ReportFormat, structured: boolean, outputPath?: string, summary?: string): void {
  if (outputPath) {
    writeReport(outputPath, result, format);
  }

  process.stdout.write(renderForStdout(result, format, structured, summary));

  if (outputPath) {
    process.stdout.write(`\n${format === "markdown" ? "Markdown" : "JSON"} report written to ${outputPath}\n`);
  }
}

function compareAgainstBaseline(current: unknown, baselinePath: string): string[] {
  const baseline = JSON.parse(readFileSync(normalizeExistingPath(baselinePath), "utf-8")) as Record<string, unknown>;
  const failures: string[] = [];

  if (typeof (current as { score?: unknown }).score === "number" && typeof baseline.score === "number") {
    if ((current as { score: number }).score < (baseline.score as number)) {
      failures.push(`score regressed from ${baseline.score} to ${(current as { score: number }).score}`);
    }
  }

  if (typeof (current as { averageScore?: unknown }).averageScore === "number" && typeof baseline.averageScore === "number") {
    if ((current as { averageScore: number }).averageScore < (baseline.averageScore as number)) {
      failures.push(`averageScore regressed from ${baseline.averageScore} to ${(current as { averageScore: number }).averageScore}`);
    }
  }

  if (typeof (current as { totalViolations?: unknown }).totalViolations === "number" && typeof baseline.totalViolations === "number") {
    if ((current as { totalViolations: number }).totalViolations > (baseline.totalViolations as number)) {
      failures.push(`totalViolations increased from ${baseline.totalViolations} to ${(current as { totalViolations: number }).totalViolations}`);
    }
  }

  return failures;
}

function applyThresholds(args: { result: unknown; failOn?: string; maxViolations?: number; baselinePath?: string }): void {
  const failures: string[] = [];
  const result = args.result as Record<string, unknown>;

  const summary = result.summary as Record<string, unknown> | undefined;
  if (args.failOn) {
    const count = typeof summary?.[args.failOn] === "number"
      ? summary[args.failOn]
      : args.failOn === "critical" && typeof result.criticalViolations === "number"
        ? result.criticalViolations
        : undefined;
    if (typeof count === "number" && count > 0) {
      failures.push(`${args.failOn} issues present: ${count}`);
    }
  }

  if (typeof args.maxViolations === "number") {
    const total = typeof summary?.violations === "number"
      ? summary.violations
      : typeof result.totalViolations === "number"
        ? result.totalViolations
        : typeof result.pagesAudited === "number" && Array.isArray((result as { pageResults?: unknown[] }).pageResults)
          ? ((result as { pageResults: Array<{ violations: number }> }).pageResults.reduce((sum, page) => sum + page.violations, 0))
          : undefined;
    if (typeof total === "number" && total > args.maxViolations) {
      failures.push(`violations ${total} exceeded max ${args.maxViolations}`);
    }
  }

  if (args.baselinePath) {
    failures.push(...compareAgainstBaseline(args.result, args.baselinePath));
  }

  if (failures.length > 0) {
    process.stderr.write(`Threshold failure: ${failures.join('; ')}\n`);
    process.exitCode = 2;
  }
}

function parseHeaders(args: string[]): Record<string, string> | undefined {
  const pairs = readFlagValues(args, "--header");
  if (pairs.length === 0) return undefined;

  const headers: Record<string, string> = {};
  for (const pair of pairs) {
    const separator = pair.indexOf(":");
    if (separator === -1) {
      throw new Error(`Invalid --header value: ${pair}. Expected 'Name: Value'.`);
    }
    const key = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    if (!key || !value) {
      throw new Error(`Invalid --header value: ${pair}. Expected 'Name: Value'.`);
    }
    headers[key] = value;
  }
  return headers;
}

function parseAuth(args: string[]): AuthConfig | undefined {
  const storageState = readFlagValue(args, "--storage-state");
  const headers = parseHeaders(args);
  const username = readFlagValue(args, "--basic-auth-user");
  const password = readFlagValue(args, "--basic-auth-pass");

  if ((username && !password) || (!username && password)) {
    throw new Error("Both --basic-auth-user and --basic-auth-pass are required together.");
  }

  const auth: AuthConfig = {
    ...(storageState ? { storageState: normalizeExistingPath(storageState) } : {}),
    ...(headers ? { headers } : {}),
    ...(username && password ? { basicAuth: { username, password } } : {}),
  };

  return Object.keys(auth).length > 0 ? auth : undefined;
}

function parseIntegerFlag(value: string | undefined, flagName: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid ${flagName} value: ${value}`);
  }
  return parsed;
}

function parseMaxFiles(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid --max-files value: ${value}`);
  }
  return parsed;
}

export async function runCli(rawArgs: string[]): Promise<void> {
  const args = [...rawArgs];
  const command = args[0];

  if (!command || command === "--help" || command === "help") {
    printHelp();
    return;
  }

  const outputPath = readFlagValue(args, "--output");
  const format = detectFormat(args, outputPath);
  const structured = hasFlag(args, "--json") || hasFlag(args, "--markdown");
  const auth = parseAuth(args);
  const failOn = readFlagValue(args, "--fail-on");
  const maxViolations = parseIntegerFlag(readFlagValue(args, "--max-violations"), "--max-violations");
  const baselinePath = readFlagValue(args, "--baseline");

  switch (command) {
    case "audit": {
      const target = args[1];
      if (!target || target.startsWith("--")) {
        throw new Error("Missing URL. Usage: a11y-agent audit <url> [--json|--markdown] [--output <file>]");
      }
      const result = await evaluateUrl({ url: target, include_html_snippets: true, ...(auth ? { auth } : {}) });
      emitResult(result, format, structured, outputPath, result.ai_summary);
      applyThresholds({ result, failOn, maxViolations, baselinePath });
      return;
    }

    case "audit:file": {
      const filePath = args[1];
      if (!filePath || filePath.startsWith("--")) {
        throw new Error("Missing file path. Usage: a11y-agent audit:file <path> [--json|--markdown] [--output <file>]");
      }
      const result = await evaluateUrl({ url: normalizeFileTarget(filePath), include_html_snippets: true, ...(auth ? { auth } : {}) });
      emitResult(result, format, structured, outputPath, result.ai_summary);
      applyThresholds({ result, failOn, maxViolations, baselinePath });
      return;
    }

    case "audit:repo": {
      const repoPath = args[1];
      if (!repoPath || repoPath.startsWith("--")) {
        throw new Error("Missing repo path. Usage: a11y-agent audit:repo <path> [--base-url <url>] [--max-files <n>] [--json|--markdown] [--output <file>]");
      }
      const root = normalizeExistingPath(repoPath);
      const baseUrl = readFlagValue(args, "--base-url");
      const maxFiles = parseMaxFiles(readFlagValue(args, "--max-files"));
      const result = await auditRepo({
        root,
        maxFiles: maxFiles ?? 20,
        ...(baseUrl ? { baseUrl } : {}),
        ...(auth ? { auth } : {}),
      });
      const summary = `Repository audit for ${result.root}\nFiles scanned: ${result.filesScanned}\nTotal violations: ${result.totalViolations}\nCritical violations: ${result.criticalViolations}`;
      emitResult(result, format, structured, outputPath, summary);
      applyThresholds({ result, failOn, maxViolations, baselinePath });
      return;
    }

    case "crawl": {
      const url = readFlagValue(args, "--url");
      const sitemap = readFlagValue(args, "--sitemap");
      const maxPages = parseMaxFiles(readFlagValue(args, "--max-pages")) ?? 20;
      if (!url && !sitemap) {
        throw new Error("Usage: a11y-agent crawl --url <url> | --sitemap <url> [--max-pages <n>] [--json|--markdown] [--output <file>]");
      }
      const result = await crawlSite({
        ...(url ? { url } : {}),
        ...(sitemap ? { sitemap } : {}),
        maxPages,
        ...(auth ? { auth } : {}),
      });
      const summary = `Crawl audit for ${result.origin}\nPages audited: ${result.pagesAudited}\nPages skipped: ${result.pagesSkipped}\nAverage score: ${result.averageScore}`;
      emitResult(result, format, structured, outputPath, summary);
      applyThresholds({ result, failOn, maxViolations, baselinePath });
      return;
    }

    case "verify": {
      const sourcePath = args[1];
      const auditUrl = readFlagValue(args, "--url");
      if (!sourcePath || sourcePath.startsWith("--") || !auditUrl) {
        throw new Error("Usage: a11y-agent verify <source-path> --url <url> [--json|--markdown] [--output <file>]");
      }
      const result = await verifyRemediation({
        source_path: normalizeExistingPath(sourcePath),
        audit_url: auditUrl,
        ...(auth ? { auth } : {}),
      });
      emitResult(result, format, structured, outputPath, result.summary);
      return;
    }

    default:
      throw new Error(`Unknown CLI command: ${command}`);
  }
}
