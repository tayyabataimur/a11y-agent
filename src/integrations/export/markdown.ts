import type { EvaluateResult } from "../../core/types.js";
import type { RepoAuditResult } from "../../tools/scan.js";
import type { VerifyResult } from "../../core/verify-service.js";
import type { CrawlSiteResult } from "../../tools/crawl.js";

function isEvaluateResult(value: unknown): value is EvaluateResult {
  return typeof value === "object" && value !== null && "score" in value && "top_issues" in value;
}

function isRepoAuditResult(value: unknown): value is RepoAuditResult {
  return typeof value === "object" && value !== null && "filesScanned" in value && "fileResults" in value;
}

function isVerifyResult(value: unknown): value is VerifyResult {
  return typeof value === "object" && value !== null && "status" in value && "next_steps" in value;
}

function isCrawlSiteResult(value: unknown): value is CrawlSiteResult {
  return typeof value === "object" && value !== null && "pagesAudited" in value && "pageResults" in value && "topViolations" in value;
}

function renderEvaluateMarkdown(result: EvaluateResult): string {
  const lines: string[] = [];
  lines.push(`# Accessibility Report`);
  lines.push("");
  lines.push(`- **URL:** ${result.url}`);
  lines.push(`- **Timestamp:** ${result.timestamp}`);
  lines.push(`- **Score:** ${result.score}/100`);
  lines.push(`- **Grade:** ${result.grade}`);
  lines.push(`- **WCAG level:** ${result.wcag_level}`);
  lines.push("");
  lines.push(`## Summary`);
  lines.push("");
  lines.push(`- Violations: ${result.summary.violations}`);
  lines.push(`- Critical: ${result.summary.critical}`);
  lines.push(`- Serious: ${result.summary.serious}`);
  lines.push(`- Moderate: ${result.summary.moderate}`);
  lines.push(`- Minor: ${result.summary.minor}`);
  lines.push(`- Auto-fixable: ${result.summary.auto_fixable_count}`);
  lines.push(`- Incomplete: ${result.summary.incomplete}`);
  lines.push("");
  lines.push(`## AI Summary`);
  lines.push("");
  lines.push(result.ai_summary);
  lines.push("");

  if (result.quick_wins.length > 0) {
    lines.push(`## Quick Wins`);
    lines.push("");
    for (const issue of result.quick_wins) {
      lines.push(`- **${issue.violation_id}** (${issue.impact}) — ${issue.headline}`);
    }
    lines.push("");
  }

  lines.push(`## Top Issues`);
  lines.push("");
  for (const issue of result.top_issues.slice(0, 10)) {
    lines.push(`### ${issue.rank}. ${issue.headline}`);
    lines.push(`- Severity: ${issue.impact}`);
    lines.push(`- WCAG: ${issue.wcag_criterion || "Best practice"}`);
    lines.push(`- Affected elements: ${issue.affected_elements}`);
    lines.push(`- Auto-fixable: ${issue.auto_fixable ? "yes" : "no"}`);
    lines.push(`- Impact: ${issue.user_impact}`);
    lines.push(`- Suggestion: ${issue.suggestion}`);
    lines.push(`- Learn more: ${issue.learn_more}`);
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function renderRepoAuditMarkdown(result: RepoAuditResult): string {
  const lines: string[] = [];
  lines.push(`# Repository Accessibility Audit`);
  lines.push("");
  lines.push(`- **Root:** ${result.root}`);
  lines.push(`- **Timestamp:** ${result.timestamp}`);
  lines.push(`- **Frameworks:** ${result.frameworks.join(", ")}`);
  lines.push(`- **Files discovered:** ${result.filesDiscovered}`);
  lines.push(`- **Files scanned:** ${result.filesScanned}`);
  lines.push(`- **Files skipped:** ${result.filesSkipped}`);
  lines.push(`- **Total violations:** ${result.totalViolations}`);
  lines.push(`- **Critical violations:** ${result.criticalViolations}`);
  lines.push(`- **Mapped violation types:** ${result.sourceMapping.mappedViolations}/${result.sourceMapping.totalViolationTypes}`);
  lines.push(`- **Average mapping confidence:** ${result.sourceMapping.averageConfidence}`);
  lines.push("");

  if (result.topViolations.length > 0) {
    lines.push(`## Top Violations`);
    lines.push("");
    for (const violation of result.topViolations) {
      lines.push(`- **${violation.id}** (${violation.impact}) — ${violation.count}`);
    }
    lines.push("");
  }

  lines.push(`## Files`);
  lines.push("");
  for (const file of result.fileResults.slice(0, 20)) {
    lines.push(`### ${file.relativeFile}`);
    lines.push(`- Framework: ${file.framework}`);
    if (file.route) lines.push(`- Route: ${file.route}`);
    lines.push(`- Audit target: ${file.auditTarget}`);
    lines.push(`- Violations: ${file.violationCount}`);
    lines.push(`- Critical: ${file.criticalCount}`);
    lines.push(`- Serious: ${file.seriousCount}`);
    lines.push(`- Source mapping confidence: ${file.sourceMappingConfidence}`);
    for (const violation of file.violations.slice(0, 10)) {
      lines.push(`  - ${violation.id} (${violation.impact}) — ${violation.nodeCount} node(s)`);
      if (violation.sourceHints[0]) {
        lines.push(`    - Likely source: ${violation.sourceHints[0].file} (${violation.sourceHints[0].confidence})`);
      }
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function renderVerifyMarkdown(result: VerifyResult): string {
  const lines: string[] = [];
  lines.push(`# Verification Plan`);
  lines.push("");
  lines.push(`- **Status:** ${result.status}`);
  lines.push(`- **Source path:** ${result.source_path}`);
  lines.push(`- **Audit URL:** ${result.audit_url}`);
  lines.push(`- **Timestamp:** ${result.timestamp}`);
  lines.push("");
  lines.push(result.summary);
  lines.push("");
  lines.push(`## Next Steps`);
  lines.push("");
  for (const step of result.next_steps) {
    lines.push(`- ${step}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function renderCrawlMarkdown(result: CrawlSiteResult): string {
  const lines: string[] = [];
  lines.push(`# Site Crawl Accessibility Audit`);
  lines.push("");
  lines.push(`- **Origin:** ${result.origin}`);
  if (result.startUrl) lines.push(`- **Start URL:** ${result.startUrl}`);
  if (result.sitemap) lines.push(`- **Sitemap:** ${result.sitemap}`);
  lines.push(`- **Timestamp:** ${result.timestamp}`);
  lines.push(`- **Pages audited:** ${result.pagesAudited}`);
  lines.push(`- **Pages skipped:** ${result.pagesSkipped}`);
  lines.push(`- **Average score:** ${result.averageScore}`);
  if (result.lowestScore) lines.push(`- **Lowest score:** ${result.lowestScore.score} (${result.lowestScore.url})`);
  if (result.highestScore) lines.push(`- **Highest score:** ${result.highestScore.score} (${result.highestScore.url})`);
  lines.push("");

  if (result.topViolations.length > 0) {
    lines.push(`## Top Violations Across Pages`);
    lines.push("");
    for (const violation of result.topViolations) {
      lines.push(`- **${violation.violation_id}** (${violation.highest_impact}) — ${violation.pages} page(s), ${violation.total_affected_elements} affected element(s)`);
    }
    lines.push("");
  }

  lines.push(`## Page Results`);
  lines.push("");
  for (const page of result.pageResults.slice(0, 25)) {
    lines.push(`### ${page.url}`);
    lines.push(`- Score: ${page.score}/100 (${page.grade})`);
    lines.push(`- WCAG level: ${page.wcag_level}`);
    lines.push(`- Violations: ${page.violations}`);
    lines.push(`- Critical: ${page.critical}`);
    lines.push(`- Serious: ${page.serious}`);
    if (page.top_issue_ids.length > 0) lines.push(`- Top issues: ${page.top_issue_ids.join(", ")}`);
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

export function toMarkdownReport(value: unknown): string {
  if (isEvaluateResult(value)) return renderEvaluateMarkdown(value);
  if (isRepoAuditResult(value)) return renderRepoAuditMarkdown(value);
  if (isVerifyResult(value)) return renderVerifyMarkdown(value);
  if (isCrawlSiteResult(value)) return renderCrawlMarkdown(value);
  return "# A11yAgent Report\n\nType not recognized for Markdown export. Use JSON export instead.\n";
}
