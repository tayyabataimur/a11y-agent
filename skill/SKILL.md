---
name: a11y-agent
description: "Use this skill whenever the user wants to check, audit, score, explain, or fix accessibility issues on any website, web app, design system, HTML page, or frontend codebase. Triggers include: any mention of 'accessibility', 'a11y', 'WCAG', 'screen reader', 'aria', 'alt text', 'colour contrast', 'keyboard navigation', or requests like 'is my site accessible?', 'fix accessibility issues', 'make my site WCAG compliant', 'audit my components for a11y', 'what's my accessibility score', or 'help me pass an accessibility audit'. Also trigger when a user shares a URL, page, component, or repo and asks for review or improvement. Use this skill early and often; most web products have fixable accessibility issues and benefit from prioritized guidance plus safe remediation."
---

# A11yAgent

Accessibility evaluation, scoring, remediation, and guidance via the A11yAgent MCP server.

## Prerequisites

The user needs the A11yAgent MCP server connected. If the tools (`evaluate`, `remediate`, `audit_component`, `fix_component`, `audit_repo`) are not available in your tool list, show them how to install it:

```json
{
  "mcpServers": {
    "a11y-agent": {
      "command": "npx",
      "args": ["-y", "a11y-agent"]
    }
  }
}
```

Then ask them to restart and try again.

---

## The standard workflow

Always follow this order. Don't jump straight to fixing without evaluating first — the score and ranked issues from `evaluate` tell you what to prioritise.

### Step 1 — Evaluate

Call `evaluate` with the live URL. This gives you a score, grade, WCAG compliance level, and a ranked list of issues with plain-English explanations and code examples.

```
evaluate({
  url: "https://example.com",         // or http://localhost:3000
  include_html_snippets: true         // shows actual failing HTML in examples
})
```

Read the `ai_summary` field and share it with the user in plain language. Focus on:
- The score and grade (0–100, A–F)
- The WCAG compliance level (Non-compliant / Partial A / A / AA / AAA)
- How many violations are auto-fixable (`quick_wins`)
- The top 3–5 issues from `top_issues`, ranked by impact × blast radius

If the score is good (≥ 80) and there are no critical violations, tell the user — that's worth acknowledging.

### Step 2 — Offer a fix

If there are auto-fixable violations, offer to patch the source file. Ask the user for the source file path that corresponds to the audited page.

Then call `remediate` in `diff` mode first, so the user can review before anything is written:

```
remediate({
  source_path: "/absolute/path/to/Component.tsx",
  audit_url: "https://example.com",
  mode: "diff",
  min_severity: "serious"    // skip minor/moderate unless user wants them too
})
```

Show the user the `fixed` array (what will be patched) and `needs_manual` (what can't be auto-patched). Show the diff.

### Step 3 — Apply

Once the user approves, call `remediate` again with `mode: "fix"`:

```
remediate({
  source_path: "/absolute/path/to/Component.tsx",
  audit_url: "https://example.com",
  mode: "fix",
  min_severity: "serious"
})
```

Confirm `written_to_disk: true` in the response. Tell the user what was changed and what still needs manual attention.

---

## Modes and filters

**`remediate` modes:**

| Mode | Use when |
|---|---|
| `"report"` | User just wants to understand violations, no changes yet |
| `"diff"` | User wants to preview the patch before applying |
| `"fix"` | User has approved and wants changes written to disk |

**Severity filter:** Use `min_severity: "critical"` when the user only wants to fix the most serious issues first. Use `"moderate"` for a more complete pass.

**Targeting specific violations:** Use `only: ["image-alt", "button-name"]` if the user has a specific concern (e.g. "just fix the missing alt text").

---

## Interpreting scores

| Score | Grade | What to tell the user |
|---|---|---|
| 90–100 | A | Excellent. Few or no violations. |
| 75–89 | B | Good. Minor issues worth cleaning up. |
| 55–74 | C | Several violations, some critical. Worth fixing before launch. |
| 35–54 | D | Significant barriers for users relying on assistive tech. |
| 0–34 | F | Major accessibility failures. Not WCAG compliant. |

**WCAG levels:**
- **Non-compliant** — fails at least one Level A criterion (the baseline)
- **Partial A** — mostly compliant but gaps remain
- **A** — passes all Level A checks
- **AA** — passes A and AA (the standard target for most sites)
- **AAA** — passes all three levels (rarely required)

Most organisations aim for WCAG 2.1 AA. If the user has a legal or procurement deadline, AA compliance is almost always what they need.

---

## Scanning a whole project

If the user wants to audit multiple pages at once, use `audit_repo` with their running dev server:

```
audit_repo({
  root: "/absolute/path/to/project",
  baseUrl: "http://localhost:3000",
  maxFiles: 20
})
```

This returns violations sorted by severity across all pages. Use it to identify the most common violations codebase-wide, then call `remediate` on the highest-priority files.

Note: `audit_repo` requires a running dev server for React/Next.js projects — without `baseUrl` it only audits static HTML files.

---

## Handling manual violations

Some violations can't be auto-patched. When `needs_manual` is non-empty, explain each one clearly:

- **`color-contrast`** — The fix requires knowing the design tokens. Tell the user to use the [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) and provide the failing colour pair from the `nodes` array.
- **`heading-order`** — Headings must descend sequentially (h1 → h2 → h3). Show the current heading structure and explain the fix.
- **`landmark-one-main`** — The page needs a `<main>` element wrapping the primary content.
- **`region`** — Content outside landmark elements needs to be moved inside `<header>`, `<main>`, `<nav>`, `<aside>`, or `<footer>`.

For each, show the relevant failing HTML from the `nodes` field so the user knows exactly what to look at.

---

## Detailed tool reference

Read `references/tools.md` for the full input/output schema of each tool — useful if the user asks about specific parameters or edge cases.

---

## Tone

- Be specific. Vague accessibility advice is not helpful. Reference the actual failing elements.
- Don't catastrophise a low score. Explain that accessibility issues are common and fixable.
- Don't dismiss a high score. Even a Grade A site should be tested with real assistive technology.
- For manual violations, give the user a concrete next action — not just "fix the contrast".
