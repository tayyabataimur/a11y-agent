import { runAxeAudit, type Violation } from "../lib/axe-runner.js";
import { AUTO_FIXABLE } from "../lib/patcher.js";
import type { EvaluateOptions, EvaluateResult, Grade, IssueSuggestion, WcagLevel } from "./types.js";

const IMPACT_DEDUCTION: Record<Violation["impact"], { base: number; perNode: number; cap: number }> = {
  critical: { base: 15, perNode: 1.5, cap: 25 },
  serious: { base: 10, perNode: 1.0, cap: 18 },
  moderate: { base: 5, perNode: 0.5, cap: 10 },
  minor: { base: 2, perNode: 0.2, cap: 4 },
};

const VIOLATION_GUIDANCE: Record<string, {
  headline: (nodeCount: number) => string;
  user_impact: string;
  suggestion: string;
  example_before: string;
  example_after: string;
}> = {
  "image-alt": {
    headline: (n) => `${n} image${n > 1 ? "s are" : " is"} missing alternative text`,
    user_impact: "Screen reader users hear nothing or the filename when encountering these images. For users who cannot see images (blind, low vision, slow connections), the content is completely lost.",
    suggestion: "Add an alt attribute to every img element. Use descriptive text that conveys the meaning of the image. For purely decorative images that add no information, use alt=\"\" to signal screen readers to skip them.",
    example_before: '<img src="team-photo.jpg">',
    example_after: '<img src="team-photo.jpg" alt="Five engineers collaborating around a whiteboard">',
  },
  "button-name": {
    headline: (n) => `${n} button${n > 1 ? "s have" : " has"} no accessible name`,
    user_impact: "Screen reader users hear 'button' with no indication of what it does. Keyboard and voice control users cannot target the button by name.",
    suggestion: "Add an aria-label attribute to buttons that contain only icons or images. If the button has visible text, ensure the text clearly describes the action. Avoid generic labels like 'Click here' or 'Submit'.",
    example_before: '<button><svg aria-hidden="true">...</svg></button>',
    example_after: '<button aria-label="Close dialog"><svg aria-hidden="true">...</svg></button>',
  },
  "link-name": {
    headline: (n) => `${n} link${n > 1 ? "s have" : " has"} no accessible name`,
    user_impact: "Screen reader users cannot determine where a link goes. Voice control users cannot click links by name. This fails basic WCAG Level A compliance.",
    suggestion: "Every link must have a descriptive accessible name. Add visible text between the anchor tags, or add an aria-label if the link contains only an icon. Avoid 'click here' or 'read more' as the sole link text.",
    example_before: '<a href="/about"><img src="arrow.svg"></a>',
    example_after: '<a href="/about" aria-label="Learn more about us"><img src="arrow.svg" alt=""></a>',
  },
  label: {
    headline: (n) => `${n} form field${n > 1 ? "s are" : " is"} missing a label`,
    user_impact: "Screen reader users cannot identify what information a field expects. Voice control users cannot target fields by their label name. This is a WCAG Level A failure.",
    suggestion: "Associate a label element with every input using htmlFor (React) or for (HTML) matching the input's id. Alternatively use aria-label or aria-labelledby. Placeholder text is not a substitute for a label.",
    example_before: '<input type="email" placeholder="Email address">',
    example_after: '<label htmlFor="email">Email address</label>\n<input id="email" type="email" placeholder="you@example.com">',
  },
  "color-contrast": {
    headline: (n) => `${n} element${n > 1 ? "s have" : " has"} insufficient colour contrast`,
    user_impact: "Users with low vision, colour blindness, or viewing in bright light cannot read this text. WCAG AA requires a 4.5:1 ratio for normal text and 3:1 for large text.",
    suggestion: "Increase the contrast between text and background colour. Use the WebAIM Contrast Checker (https://webaim.org/resources/contrastchecker/) to find compliant colour combinations. Common fixes: darken text colour, lighten background, or increase font weight.",
    example_before: "/* text: #9CA3AF on white #FFFFFF — ratio 2.85:1 (fails) */\ncolor: #9CA3AF;",
    example_after: "/* text: #6B7280 on white #FFFFFF — ratio 4.62:1 (passes AA) */\ncolor: #6B7280;",
  },
  "html-has-lang": {
    headline: () => "Page is missing a language declaration",
    user_impact: "Screen readers cannot select the correct voice/pronunciation engine. Translation tools cannot detect the language automatically.",
    suggestion: "Add a lang attribute to the root <html> element with the appropriate BCP 47 language tag.",
    example_before: "<html>",
    example_after: '<html lang="en">',
  },
  "heading-order": {
    headline: () => "Heading levels are out of order",
    user_impact: "Screen reader users navigate by headings to understand page structure. Skipped heading levels (e.g. h1 → h3) break this mental model and make content harder to scan.",
    suggestion: "Headings must descend sequentially: h1 → h2 → h3. Do not skip levels for visual styling — use CSS to control size instead. Each page should have exactly one h1.",
    example_before: "<h1>Page title</h1>\n<h3>Section (skipped h2)</h3>",
    example_after: "<h1>Page title</h1>\n<h2>Section</h2>\n<h3>Subsection</h3>",
  },
  "aria-required-attr": {
    headline: (n) => `${n} ARIA element${n > 1 ? "s are" : " is"} missing required attributes`,
    user_impact: "Assistive technologies cannot correctly interpret these elements, leading to confusing or broken experiences for screen reader users.",
    suggestion: "When using ARIA roles, include all required ARIA attributes. For example, role='checkbox' requires aria-checked, role='combobox' requires aria-expanded and aria-controls.",
    example_before: '<div role="checkbox">Subscribe</div>',
    example_after: '<div role="checkbox" aria-checked="false">Subscribe</div>',
  },
  "landmark-one-main": {
    headline: () => "Page is missing a main landmark",
    user_impact: "Keyboard and screen reader users cannot skip to the main content. This is a common navigation barrier for users who visit many pages on your site.",
    suggestion: "Wrap the primary page content in a <main> element. Every page should have exactly one <main>.",
    example_before: '<div class="content">...</div>',
    example_after: "<main>...</main>",
  },
  region: {
    headline: (n) => `${n} content area${n > 1 ? "s are" : " is"} not inside a landmark region`,
    user_impact: "Screen reader users navigating by landmarks cannot reach this content using shortcut keys.",
    suggestion: "Wrap all page content in appropriate landmark elements: <header>, <nav>, <main>, <aside>, <footer>. Content outside landmarks is invisible to landmark navigation.",
    example_before: "<div>Page content here</div>",
    example_after: "<main>Page content here</main>",
  },
};

function calculateScore(violations: Violation[]): number {
  let deduction = 0;
  for (const v of violations) {
    const d = IMPACT_DEDUCTION[v.impact];
    const nodeDeduction = Math.min(v.nodes.length * d.perNode, d.cap - d.base);
    deduction += Math.min(d.base + nodeDeduction, d.cap);
  }
  return Math.max(0, Math.round(100 - deduction));
}

function scoreToGrade(score: number): Grade {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 55) return "C";
  if (score >= 35) return "D";
  return "F";
}

function deriveWcagLevel(violations: Violation[]): WcagLevel {
  const tags = new Set(violations.flatMap((v) => v.wcag));
  const hasA = [...tags].some((t) => t.includes("2A") && !t.includes("2AA") && !t.includes("2AAA"));
  const hasAA = [...tags].some((t) => t.includes("2AA") && !t.includes("2AAA"));
  const rawTags = new Set(violations.flatMap((v) => (v as Violation & { _rawTags?: string[] })._rawTags ?? []));

  if (violations.length === 0) return "AAA";
  if (hasA || rawTags.has("wcag2a")) return "Non-compliant";
  if (violations.some((v) => v.wcag.some((t) => /WCAG\s+\d+\.\d+\.\d+/.test(t)))) {
    if (hasAA) return "A";
    return "AA";
  }
  return "Partial A";
}

function generateSuggestion(v: Violation, rank: number, includeHtmlSnippets: boolean): IssueSuggestion {
  const guidance = VIOLATION_GUIDANCE[v.id];
  const headline = guidance
    ? guidance.headline(v.nodes.length)
    : `${v.nodes.length} element${v.nodes.length > 1 ? "s" : ""} ${v.description.toLowerCase()}`;

  const user_impact = guidance?.user_impact ?? "This violation affects users relying on assistive technologies.";
  const suggestion = guidance?.suggestion ?? `Fix this violation by addressing the failing elements. See ${v.helpUrl} for detailed guidance.`;

  let example_before = guidance?.example_before ?? (v.nodes[0]?.html ? `<!-- Failing element -->\n${v.nodes[0].html}` : "<!-- See failing elements below -->");
  let example_after = guidance?.example_after ?? `<!-- See guidance at ${v.helpUrl} -->`;

  if (includeHtmlSnippets && v.nodes.length > 0 && v.nodes[0].html) {
    example_before = v.nodes.slice(0, 3).map((n) => n.html).join("\n");
  }

  return {
    rank,
    violation_id: v.id,
    impact: v.impact,
    wcag_criterion: v.wcag.filter((t) => /WCAG\s+\d/.test(t)).join(", ") || v.wcag.join(", "),
    affected_elements: v.nodes.length,
    headline,
    user_impact,
    suggestion,
    example_before,
    example_after,
    auto_fixable: AUTO_FIXABLE.has(v.id),
    learn_more: v.helpUrl,
  };
}

function rankViolations(violations: Violation[]): Violation[] {
  const impactWeight: Record<Violation["impact"], number> = {
    critical: 40,
    serious: 25,
    moderate: 10,
    minor: 3,
  };

  return [...violations].sort((a, b) => {
    const scoreA = impactWeight[a.impact] * a.nodes.length;
    const scoreB = impactWeight[b.impact] * b.nodes.length;
    return scoreB - scoreA;
  });
}

function buildAiSummary(result: Omit<EvaluateResult, "ai_summary">): string {
  const { url, score, grade, wcag_level, summary, top_issues, quick_wins } = result;
  const lines: string[] = [];

  lines.push(`Accessibility evaluation for ${url}`);
  lines.push(`Score: ${score}/100 (Grade ${grade}) — WCAG compliance: ${wcag_level}`);
  lines.push("");

  if (summary.violations === 0) {
    lines.push("No violations found. The page passes all axe-core checks.");
    return lines.join("\n");
  }

  lines.push(
    `Found ${summary.violations} violation${summary.violations > 1 ? "s" : ""} across ${summary.total_checks} checks: ${summary.critical} critical, ${summary.serious} serious, ${summary.moderate} moderate, ${summary.minor} minor.`
  );
  lines.push(`${summary.passed} checks pass. ${summary.incomplete} could not be fully evaluated automatically.`);
  lines.push("");

  if (quick_wins.length > 0) {
    lines.push(`Quick wins — ${quick_wins.length} violation${quick_wins.length > 1 ? "s" : ""} can be auto-patched using the remediate tool:`);
    for (const qw of quick_wins) {
      lines.push(`  • ${qw.violation_id} (${qw.impact}): ${qw.headline} — ${qw.affected_elements} element${qw.affected_elements > 1 ? "s" : ""} affected`);
    }
    lines.push("");
  }

  lines.push("Top issues to fix (in priority order):");
  for (const issue of top_issues.slice(0, 5)) {
    lines.push(`  ${issue.rank}. [${issue.impact.toUpperCase()}] ${issue.headline}`);
    lines.push(`     WCAG: ${issue.wcag_criterion || "Best practice"}`);
    lines.push(`     Fix: ${issue.suggestion.split(".")[0]}.`);
    if (issue.example_after && !issue.example_after.includes("<!-- See")) {
      lines.push(`     Example: ${issue.example_after.split("\n")[0]}`);
    }
  }

  lines.push("");
  lines.push("To auto-patch all fixable violations, call the remediate tool with mode='fix' and the source file path.");

  return lines.join("\n");
}

export async function evaluateUrl(options: EvaluateOptions): Promise<EvaluateResult> {
  const audit = await runAxeAudit(options.url, options.auth);
  const score = calculateScore(audit.violations);
  const grade = scoreToGrade(score);
  const wcag_level = deriveWcagLevel(audit.violations);

  const ranked = rankViolations(audit.violations);
  const top_issues = ranked.map((v, i) => generateSuggestion(v, i + 1, options.include_html_snippets ?? true));
  const quick_wins = top_issues.filter((s) => s.auto_fixable);

  const summary = {
    total_checks: audit.violations.length + audit.passes,
    passed: audit.passes,
    violations: audit.violations.length,
    critical: audit.violations.filter((v) => v.impact === "critical").length,
    serious: audit.violations.filter((v) => v.impact === "serious").length,
    moderate: audit.violations.filter((v) => v.impact === "moderate").length,
    minor: audit.violations.filter((v) => v.impact === "minor").length,
    auto_fixable_count: audit.violations.filter((v) => AUTO_FIXABLE.has(v.id)).length,
    incomplete: audit.incomplete,
  };

  const partial: Omit<EvaluateResult, "ai_summary"> = {
    url: audit.url,
    timestamp: audit.timestamp,
    score,
    grade,
    wcag_level,
    summary,
    top_issues,
    quick_wins,
  };

  return { ...partial, ai_summary: buildAiSummary(partial) };
}
