import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { runAxeAudit, runAxeAuditHtml, type AuditResult } from "../lib/axe-runner.js";
import type { AuthConfig } from "./auth.js";

export interface VerifyInput {
  source_path: string;
  audit_url: string;
  auth?: AuthConfig;
}

export interface VerificationSnapshot {
  violations: number;
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
  passes: number;
  incomplete: number;
}

export interface VerifyResult {
  status: "verified" | "not_supported";
  method: "html-inline" | "rerun-audit-url" | "baseline-only";
  source_path: string;
  audit_url: string;
  summary: string;
  before?: VerificationSnapshot;
  after?: VerificationSnapshot;
  resolved_violation_ids: string[];
  remaining_violation_ids: string[];
  score_delta?: {
    violations: number;
    critical: number;
    serious: number;
  };
  next_steps: string[];
  timestamp: string;
}

function summarize(audit: AuditResult): VerificationSnapshot {
  return {
    violations: audit.violations.length,
    critical: audit.violations.filter((v) => v.impact === "critical").length,
    serious: audit.violations.filter((v) => v.impact === "serious").length,
    moderate: audit.violations.filter((v) => v.impact === "moderate").length,
    minor: audit.violations.filter((v) => v.impact === "minor").length,
    passes: audit.passes,
    incomplete: audit.incomplete,
  };
}

function difference(before: AuditResult, after: AuditResult): { resolved: string[]; remaining: string[] } {
  const beforeIds = new Set(before.violations.map((v) => v.id));
  const afterIds = new Set(after.violations.map((v) => v.id));

  return {
    resolved: [...beforeIds].filter((id) => !afterIds.has(id)).sort(),
    remaining: [...afterIds].sort(),
  };
}

function isHtmlPath(path: string): boolean {
  return [".html", ".htm"].includes(extname(path).toLowerCase());
}

export async function verifyPatchedSource(args: {
  source_path: string;
  audit_url: string;
  original_source: string;
  patched_source: string;
  baseline_audit: AuditResult;
  mode: "diff" | "fix";
  auth?: AuthConfig;
}): Promise<VerifyResult> {
  let beforeAudit: AuditResult;
  let afterAudit: AuditResult;
  let method: VerifyResult["method"];

  if (isHtmlPath(args.source_path)) {
    beforeAudit = await runAxeAuditHtml(args.original_source, args.auth);
    afterAudit = await runAxeAuditHtml(args.patched_source, args.auth);
    method = "html-inline";
  } else if (args.mode === "fix") {
    beforeAudit = args.baseline_audit;
    afterAudit = await runAxeAudit(args.audit_url, args.auth);
    method = "rerun-audit-url";
  } else {
    return {
      status: "not_supported",
      method: "baseline-only",
      source_path: args.source_path,
      audit_url: args.audit_url,
      summary:
        "Verification is not available for diff-only non-HTML remediation yet. Use fix mode to write changes, then rerun verification against the live audit URL.",
      resolved_violation_ids: [],
      remaining_violation_ids: args.baseline_audit.violations.map((v) => v.id).sort(),
      next_steps: [
        "Run remediation with mode='fix' to allow a fresh audit against the rendered URL.",
        "Use HTML files for inline before/after verification without writing to disk."
      ],
      timestamp: new Date().toISOString(),
    };
  }

  const { resolved, remaining } = difference(beforeAudit, afterAudit);
  const before = summarize(beforeAudit);
  const after = summarize(afterAudit);

  return {
    status: "verified",
    method,
    source_path: args.source_path,
    audit_url: args.audit_url,
    summary:
      `Verification complete. Violations changed from ${before.violations} to ${after.violations}; critical issues changed from ${before.critical} to ${after.critical}.`,
    before,
    after,
    resolved_violation_ids: resolved,
    remaining_violation_ids: remaining,
    score_delta: {
      violations: after.violations - before.violations,
      critical: after.critical - before.critical,
      serious: after.serious - before.serious,
    },
    next_steps: [
      "Review any remaining serious or critical issues.",
      "If labels or aria placeholders were added, replace placeholder text with real product-specific language.",
      "Rerun the full page audit after any manual fixes."
    ],
    timestamp: new Date().toISOString(),
  };
}

export async function verifyRemediation(input: VerifyInput): Promise<VerifyResult> {
  const currentSource = readFileSync(input.source_path, "utf-8");

  if (isHtmlPath(input.source_path)) {
    const audit = await runAxeAuditHtml(currentSource, input.auth);
    const summary = summarize(audit);
    return {
      status: "verified",
      method: "html-inline",
      source_path: input.source_path,
      audit_url: input.audit_url,
      summary: `Current HTML file audit found ${summary.violations} violations, including ${summary.critical} critical and ${summary.serious} serious issues.`,
      after: summary,
      resolved_violation_ids: [],
      remaining_violation_ids: audit.violations.map((v) => v.id).sort(),
      next_steps: [
        "Use this as the current-state verification snapshot.",
        "After remediation, compare this snapshot with a new verification run or the remediation verification block."
      ],
      timestamp: new Date().toISOString(),
    };
  }

  const audit = await runAxeAudit(input.audit_url, input.auth);
  const summary = summarize(audit);
  return {
    status: "verified",
    method: "rerun-audit-url",
    source_path: input.source_path,
    audit_url: input.audit_url,
    summary: `Rendered audit found ${summary.violations} violations, including ${summary.critical} critical and ${summary.serious} serious issues.`,
    after: summary,
    resolved_violation_ids: [],
    remaining_violation_ids: audit.violations.map((v) => v.id).sort(),
    next_steps: [
      "Use this as the current rendered baseline.",
      "Run remediation in fix mode to unlock before/after verification deltas."
    ],
    timestamp: new Date().toISOString(),
  };
}
