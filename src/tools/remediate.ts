import { z } from "zod";
import { readFileSync, writeFileSync } from "fs";
import { runAxeAudit, type Violation } from "../lib/axe-runner.js";
import { patchAll, AUTO_FIXABLE, PATCH_REGISTRY } from "../lib/patcher.js";

// ─── Config schema ─────────────────────────────────────────────────────────────

export const RemediateMode = z.enum(["report", "diff", "fix"]).describe(
  [
    '"report" — audit only. Returns the full violations list with no patching. Use this when you want to understand the scope of issues before touching any code.',
    '"diff"   — audit + patch. Applies all auto-fixable violations and returns the before/after diff for review. Does NOT write to disk. Use this to preview changes.',
    '"fix"    — audit + patch + write. Applies all auto-fixable violations and writes the patched source back to disk. Use this to remediate in one pass.',
  ].join(" | ")
);

export const SeverityLevel = z.enum(["minor", "moderate", "serious", "critical"]);

const SEVERITY_ORDER: Record<string, number> = {
  minor: 1,
  moderate: 2,
  serious: 3,
  critical: 4,
};

export const remediateSchema = z.object({
  source_path: z
    .string()
    .describe(
      "Absolute path to the React/TSX/JSX source file to patch. This is the file that will be modified in 'fix' mode."
    ),

  audit_url: z
    .string()
    .describe(
      "URL or absolute file path to audit with axe-core. For React components this should be the live rendered URL (e.g. http://localhost:3000/about). For plain HTML files, pass the absolute file path."
    ),

  mode: RemediateMode.default("diff"),

  min_severity: SeverityLevel.default("serious").describe(
    "Minimum violation severity to act on. Violations below this threshold are reported but not patched. Defaults to 'serious'."
  ),

  only: z
    .array(z.string())
    .optional()
    .describe(
      "Optional allowlist of axe violation IDs to act on (e.g. ['image-alt', 'button-name']). When provided, only these violations are patched. All others appear in the report but are skipped. Omit to act on all violations above min_severity."
    ),
});

export type RemediateInput = z.infer<typeof remediateSchema>;

// ─── Output types ──────────────────────────────────────────────────────────────

export interface FixedViolation {
  violation_id: string;
  wcag: string;
  explanation: string;
  nodes_affected: number;
}

export interface ManualViolation {
  violation_id: string;
  impact: Violation["impact"];
  description: string;
  wcag: string[];
  reason: string;
  nodes: Array<{ selector: string; html: string; failureSummary: string }>;
}

export interface SkippedViolation {
  violation_id: string;
  impact: Violation["impact"];
  reason: "below_severity_threshold" | "not_in_allowlist";
}

export interface RemediateResult {
  mode: string;
  audit_url: string;
  source_path: string;
  min_severity: string;
  summary: {
    total_violations: number;
    auto_fixed: number;
    needs_manual: number;
    skipped: number;
    written_to_disk: boolean;
  };
  fixed: FixedViolation[];
  needs_manual: ManualViolation[];
  skipped: SkippedViolation[];
  // Only present in "diff" and "fix" modes when changes were made
  diff?: {
    original: string;
    patched: string;
  };
}

// ─── Implementation ────────────────────────────────────────────────────────────

function meetsThreshold(impact: Violation["impact"], minSeverity: string): boolean {
  return (SEVERITY_ORDER[impact] ?? 0) >= (SEVERITY_ORDER[minSeverity] ?? 0);
}

export async function remediate(input: RemediateInput): Promise<RemediateResult> {
  // Step 1: Run the audit
  const auditResult = await runAxeAudit(input.audit_url);

  // Early return for "report" mode — no patching, just the violation list
  if (input.mode === "report") {
    const violations = auditResult.violations;
    const manualViolations: ManualViolation[] = violations.map((v) => ({
      violation_id: v.id,
      impact: v.impact,
      description: v.description,
      wcag: v.wcag,
      reason: AUTO_FIXABLE.has(v.id)
        ? 'Use mode "diff" or "fix" to auto-patch this violation.'
        : "No automatic patch available. Manual remediation required.",
      nodes: v.nodes,
    }));

    return {
      mode: "report",
      audit_url: input.audit_url,
      source_path: input.source_path,
      min_severity: input.min_severity,
      summary: {
        total_violations: violations.length,
        auto_fixed: 0,
        needs_manual: violations.filter((v) => !AUTO_FIXABLE.has(v.id)).length,
        skipped: 0,
        written_to_disk: false,
      },
      fixed: [],
      needs_manual: manualViolations,
      skipped: [],
    };
  }

  // Step 2: Categorise violations
  const toFix: string[] = [];
  const manualViolations: ManualViolation[] = [];
  const skippedViolations: SkippedViolation[] = [];

  for (const v of auditResult.violations) {
    // Check severity threshold
    if (!meetsThreshold(v.impact, input.min_severity)) {
      skippedViolations.push({
        violation_id: v.id,
        impact: v.impact,
        reason: "below_severity_threshold",
      });
      continue;
    }

    // Check allowlist
    if (input.only && !input.only.includes(v.id)) {
      skippedViolations.push({
        violation_id: v.id,
        impact: v.impact,
        reason: "not_in_allowlist",
      });
      continue;
    }

    // Check if patchable
    if (AUTO_FIXABLE.has(v.id) && v.id in PATCH_REGISTRY) {
      toFix.push(v.id);
    } else {
      manualViolations.push({
        violation_id: v.id,
        impact: v.impact,
        description: v.description,
        wcag: v.wcag,
        reason: "No automatic patch available for this violation type. Manual remediation required.",
        nodes: v.nodes,
      });
    }
  }

  // Step 3: Apply patches in a single chained pass (no re-reading from disk)
  const originalSource = readFileSync(input.source_path, "utf-8");
  const filename = input.source_path.replace(/.*\//, "");

  const { finalSource, results: patchResults } = patchAll(originalSource, filename, toFix);

  // Build fixed/notFixed from patch results
  const fixedViolations: FixedViolation[] = [];
  for (const pr of patchResults) {
    if (pr.changed) {
      const violation = auditResult.violations.find((v) => v.id === pr.violation_id);
      fixedViolations.push({
        violation_id: pr.violation_id,
        wcag: pr.wcag,
        explanation: pr.explanation,
        nodes_affected: violation?.nodes.length ?? 0,
      });
    } else {
      // Patch strategy ran but made no changes (e.g. violation is in file but patcher couldn't find it)
      manualViolations.push({
        violation_id: pr.violation_id,
        impact: auditResult.violations.find((v) => v.id === pr.violation_id)?.impact ?? "moderate",
        description: auditResult.violations.find((v) => v.id === pr.violation_id)?.description ?? "",
        wcag: auditResult.violations.find((v) => v.id === pr.violation_id)?.wcag ?? [],
        reason: pr.explanation,
        nodes: auditResult.violations.find((v) => v.id === pr.violation_id)?.nodes ?? [],
      });
    }
  }

  const sourceChanged = finalSource !== originalSource;

  // Step 4: Write to disk in "fix" mode
  let writtenToDisk = false;
  if (input.mode === "fix" && sourceChanged) {
    writeFileSync(input.source_path, finalSource, "utf-8");
    writtenToDisk = true;
  }

  return {
    mode: input.mode,
    audit_url: input.audit_url,
    source_path: input.source_path,
    min_severity: input.min_severity,
    summary: {
      total_violations: auditResult.violations.length,
      auto_fixed: fixedViolations.length,
      needs_manual: manualViolations.length,
      skipped: skippedViolations.length,
      written_to_disk: writtenToDisk,
    },
    fixed: fixedViolations,
    needs_manual: manualViolations,
    skipped: skippedViolations,
    ...(sourceChanged && { diff: { original: originalSource, patched: finalSource } }),
  };
}
