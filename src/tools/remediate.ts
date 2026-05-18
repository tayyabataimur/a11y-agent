import { z } from "zod";
import { readFileSync, writeFileSync } from "fs";
import { runAxeAudit, type Violation } from "../lib/axe-runner.js";
import { patchAll, AUTO_FIXABLE, GUIDED_FIXABLE, PATCH_REGISTRY, getAutofixMeta, type AutofixMeta } from "../lib/patcher.js";
import { verifyPatchedSource, type VerifyResult } from "../core/verify-service.js";
import { authConfigSchema } from "../core/auth.js";

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
      "Absolute path to the source file to patch. HTML is supported directly; framework files can be patched when a safe strategy exists."
    ),

  audit_url: z
    .string()
    .describe(
      "URL or absolute file path to audit with axe-core. For framework components this should be the live rendered URL (e.g. http://localhost:3000/about). For plain HTML files, pass the absolute file path."
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

  verify: z
    .boolean()
    .default(true)
    .describe(
      "When true, rerun verification after patching when supported. HTML files can be verified inline in diff or fix mode; rendered framework routes can be re-audited in fix mode."
    ),

  apply_drafts: z
    .boolean()
    .default(false)
    .describe(
      "Opt-in to apply guided-fix (draft) strategies such as placeholder aria-labels or empty alt insertion. These satisfy automated checks but require human review to avoid automated-pass/manual-fail outcomes. When false (default) draft fixes appear in needs_manual with the suggested patch text, but are not applied."
    ),
  auth: authConfigSchema.optional(),
});

export type RemediateInput = z.infer<typeof remediateSchema>;

export interface FixedViolation {
  violation_id: string;
  wcag: string;
  explanation: string;
  nodes_affected: number;
  autofix?: AutofixMeta;
}

export interface ManualViolation {
  violation_id: string;
  impact: Violation["impact"];
  description: string;
  wcag: string[];
  reason: string;
  nodes: Array<{ selector: string; html: string; failureSummary: string }>;
  autofix?: AutofixMeta;
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
  autofix_catalog: AutofixMeta[];
  summary: {
    total_violations: number;
    auto_fixed: number;
    needs_manual: number;
    skipped: number;
    written_to_disk: boolean;
    verification_attempted: boolean;
  };
  fixed: FixedViolation[];
  needs_manual: ManualViolation[];
  skipped: SkippedViolation[];
  diff?: {
    original: string;
    patched: string;
  };
  verification?: VerifyResult;
}

function meetsThreshold(impact: Violation["impact"], minSeverity: string): boolean {
  return (SEVERITY_ORDER[impact] ?? 0) >= (SEVERITY_ORDER[minSeverity] ?? 0);
}

export async function remediate(input: RemediateInput): Promise<RemediateResult> {
  const auditResult = await runAxeAudit(input.audit_url, input.auth);

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
      ...(getAutofixMeta(v.id) ? { autofix: getAutofixMeta(v.id) } : {}),
    }));

    return {
      mode: "report",
      audit_url: input.audit_url,
      source_path: input.source_path,
      min_severity: input.min_severity,
      autofix_catalog: Object.keys(PATCH_REGISTRY).map((id) => getAutofixMeta(id)!).filter(Boolean),
      summary: {
        total_violations: violations.length,
        auto_fixed: 0,
        needs_manual: violations.filter((v) => !AUTO_FIXABLE.has(v.id)).length,
        skipped: 0,
        written_to_disk: false,
        verification_attempted: false,
      },
      fixed: [],
      needs_manual: manualViolations,
      skipped: [],
    };
  }

  const toFix: string[] = [];
  const manualViolations: ManualViolation[] = [];
  const skippedViolations: SkippedViolation[] = [];

  for (const v of auditResult.violations) {
    const meta = getAutofixMeta(v.id);

    if (!meetsThreshold(v.impact, input.min_severity)) {
      skippedViolations.push({
        violation_id: v.id,
        impact: v.impact,
        reason: "below_severity_threshold",
      });
      continue;
    }

    if (input.only && !input.only.includes(v.id)) {
      skippedViolations.push({
        violation_id: v.id,
        impact: v.impact,
        reason: "not_in_allowlist",
      });
      continue;
    }

    const isSafe = AUTO_FIXABLE.has(v.id) && v.id in PATCH_REGISTRY;
    const isDraft = GUIDED_FIXABLE.has(v.id) && v.id in PATCH_REGISTRY;

    if (isSafe || (isDraft && input.apply_drafts)) {
      toFix.push(v.id);
    } else {
      manualViolations.push({
        violation_id: v.id,
        impact: v.impact,
        description: v.description,
        wcag: v.wcag,
        reason: isDraft
          ? "Draft autofix available (e.g. placeholder aria-label or empty alt). Pass apply_drafts=true to apply it, but you must review and replace the placeholder before merging."
          : "No automatic patch available for this violation type. Manual remediation required.",
        nodes: v.nodes,
        ...(meta ? { autofix: meta } : {}),
      });
    }
  }

  const originalSource = readFileSync(input.source_path, "utf-8");
  const filename = input.source_path.replace(/.*\//, "");
  const { finalSource, results: patchResults } = patchAll(originalSource, filename, toFix);

  const fixedViolations: FixedViolation[] = [];
  for (const pr of patchResults) {
    const meta = getAutofixMeta(pr.violation_id);
    if (pr.changed) {
      const violation = auditResult.violations.find((v) => v.id === pr.violation_id);
      fixedViolations.push({
        violation_id: pr.violation_id,
        wcag: pr.wcag,
        explanation: pr.explanation,
        nodes_affected: violation?.nodes.length ?? 0,
        ...(meta ? { autofix: meta } : {}),
      });
    } else {
      manualViolations.push({
        violation_id: pr.violation_id,
        impact: auditResult.violations.find((v) => v.id === pr.violation_id)?.impact ?? "moderate",
        description: auditResult.violations.find((v) => v.id === pr.violation_id)?.description ?? "",
        wcag: auditResult.violations.find((v) => v.id === pr.violation_id)?.wcag ?? [],
        reason: pr.explanation,
        nodes: auditResult.violations.find((v) => v.id === pr.violation_id)?.nodes ?? [],
        ...(meta ? { autofix: meta } : {}),
      });
    }
  }

  const sourceChanged = finalSource !== originalSource;

  let writtenToDisk = false;
  if (input.mode === "fix" && sourceChanged) {
    writeFileSync(input.source_path, finalSource, "utf-8");
    writtenToDisk = true;
  }

  let verification: VerifyResult | undefined;
  if (input.verify && sourceChanged) {
    verification = await verifyPatchedSource({
      source_path: input.source_path,
      audit_url: input.audit_url,
      original_source: originalSource,
      patched_source: finalSource,
      baseline_audit: auditResult,
      mode: input.mode,
      ...(input.auth ? { auth: input.auth } : {}),
    });
  }

  return {
    mode: input.mode,
    audit_url: input.audit_url,
    source_path: input.source_path,
    min_severity: input.min_severity,
    autofix_catalog: Object.keys(PATCH_REGISTRY).map((id) => getAutofixMeta(id)!).filter(Boolean),
    summary: {
      total_violations: auditResult.violations.length,
      auto_fixed: fixedViolations.length,
      needs_manual: manualViolations.length,
      skipped: skippedViolations.length,
      written_to_disk: writtenToDisk,
      verification_attempted: Boolean(input.verify && sourceChanged),
    },
    fixed: fixedViolations,
    needs_manual: manualViolations,
    skipped: skippedViolations,
    ...(sourceChanged ? { diff: { original: originalSource, patched: finalSource } } : {}),
    ...(verification ? { verification } : {}),
  };
}
