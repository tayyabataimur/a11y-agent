<div align="center">

# A11yAgent

**Accessibility auditing and auto-patching as an MCP server**

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](https://opensource.org/licenses/MIT)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-compatible-blue)](https://modelcontextprotocol.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript)](https://www.typescriptlang.org)
[![Powered by axe-core](https://img.shields.io/badge/powered%20by-axe--core-orange)](https://github.com/dequelabs/axe-core)

[Getting started](#getting-started) · [Tools](#tools) · [Workflow](#workflow) · [Contributing](#contributing)

</div>

---

Most accessibility MCP servers give you a list of violations and stop there. **A11yAgent** closes the full loop: evaluate a live site, receive a scored report with before/after code examples, then patch the source file in one call.

Works with any AI assistant that supports the Model Context Protocol — Claude, Cursor, GitHub Copilot, Cline, and more.

```
evaluate("https://yoursite.com")  →  score 62/100 · Grade C · Non-compliant
                                       5 auto-fixable violations found

remediate(source, url, mode="diff")  →  before/after diff for review

remediate(source, url, mode="fix")   →  4 violations patched, written to disk
```

---

## Getting started

**Add to Claude Desktop or Claude Code:**

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

**Add to Cursor / Cline / GitHub Copilot:**

Point your editor's MCP config at `npx a11y-agent`.

**Run locally:**

```sh
npm install
npx playwright install chromium
npm run build
node dist/index.js
```

---

## Deployment

**Via npx (recommended for developers)**

Runs on stdio — Claude Desktop and most MCP clients connect this way. Supports `localhost` URLs and offline environments.

```json
{
  "mcpServers": {
    "a11y-agent": { "command": "npx", "args": ["-y", "a11y-agent"] }
  }
}
```

**HTTP server mode (for shared/hosted instances)**

Set `A11Y_AGENT_PORT` to start the MCP Streamable HTTP server instead of stdio:

```sh
A11Y_AGENT_PORT=3000 npx a11y-agent
# MCP endpoint: http://localhost:3000/mcp
# Health check:  http://localhost:3000/health
```

**Docker (self-host on Railway, Render, or a VPS)**

```sh
docker build -t a11y-agent .
docker run -p 3000:3000 -e A11Y_AGENT_PORT=3000 a11y-agent
```

Deploy button for Railway:

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

> [!NOTE]
> Hosted instances can only audit public URLs. To audit `localhost` during development, use the `npx` stdio mode.

---

## Workflow

The intended flow is three tool calls: evaluate to understand, diff to preview, fix to apply.

```
┌─────────────────────────────────────────────┐
│  evaluate(url)                              │
│  → score, grade, WCAG level                │
│  → ranked issues with code examples        │
│  → quick_wins: violations ready to patch   │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  remediate(source, url, mode="diff")        │
│  → before/after diff, nothing written       │
│  → fixed[], needs_manual[], skipped[]       │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  remediate(source, url, mode="fix")         │
│  → same as diff + writes to disk            │
│  → written_to_disk: true                    │
└─────────────────────────────────────────────┘
```

---

## Tools

### `evaluate`

Evaluates a live URL and produces a scored report readable by any AI assistant.

**Input:**

```ts
{
  url: string;                  // live URL or file:// path
  include_html_snippets?: boolean; // include actual failing HTML (default: true)
  include_passing?: boolean;    // include passing checks (default: false)
}
```

**Output (key fields):**

```jsonc
{
  "score": 62,           // 0-100
  "grade": "C",          // A / B / C / D / F
  "wcag_level": "Non-compliant", // AAA / AA / A / Partial A / Non-compliant
  "summary": {
    "violations": 8,
    "critical": 2,
    "auto_fixable_count": 5
  },
  "top_issues": [
    {
      "rank": 1,
      "violation_id": "image-alt",
      "impact": "critical",
      "wcag_criterion": "WCAG 1.1.1",
      "affected_elements": 6,
      "headline": "6 images are missing alternative text",
      "user_impact": "Screen reader users hear nothing or the filename...",
      "suggestion": "Add an alt attribute to every img element...",
      "example_before": "<img src=\"hero.jpg\">",
      "example_after": "<img src=\"hero.jpg\" alt=\"Team collaborating around a whiteboard\">",
      "auto_fixable": true
    }
  ],
  "quick_wins": [...],   // auto-fixable violations only
  "ai_summary": "Score: 62/100 (Grade C). Found 8 violations: 2 critical..."
}
```

The `ai_summary` field is a plain-text narrative that any AI assistant can relay directly to a user without further processing.

---

### `remediate`

Audits a rendered URL and patches the corresponding source file. All violations are applied in a single chained pass — no re-reading from disk between patches.

**Input:**

```ts
{
  source_path: string;  // .tsx / .jsx / .html file to patch
  audit_url: string;    // rendered URL to audit (live server or file://)
  mode: "report" | "diff" | "fix";
  min_severity?: "minor" | "moderate" | "serious" | "critical"; // default: "serious"
  only?: string[];      // allowlist of violation IDs (optional)
}
```

**Modes:**

| Mode | What it does |
|---|---|
| `"report"` | Audit only — returns violations, no changes to any file |
| `"diff"` | Audit + patch — returns before/after diff, does not write to disk |
| `"fix"` | Audit + patch + write — applies all auto-fixable violations to disk |

**Output:**

```jsonc
{
  "summary": {
    "total_violations": 6,
    "auto_fixed": 4,
    "needs_manual": 2,
    "written_to_disk": false  // true in "fix" mode
  },
  "fixed": [
    { "violation_id": "image-alt", "wcag": "WCAG 1.1.1", "nodes_affected": 6 }
  ],
  "needs_manual": [
    { "violation_id": "color-contrast", "reason": "Cannot patch without design token context." }
  ],
  "diff": {
    "original": "...",
    "patched": "..."
  }
}
```

---

### `audit_component`

Runs a raw axe-core audit on a URL or HTML file and returns the unprocessed violation list. Use `evaluate` if you want scoring and suggestions; use this for direct integration with other tooling.

```ts
{ path: string } // URL or absolute file path
```

---

### `fix_component`

Patches a single violation in a source file and returns the before/after diff. Use `remediate` for the full loop; use this when you need granular control over individual violations.

```ts
{
  path: string;          // absolute path to .tsx / .jsx / .html
  violation_id: string;  // axe violation ID
  write?: boolean;       // write to disk (default: false)
}
```

**Supported violation IDs:**

| ID | What it patches | WCAG |
|---|---|---|
| `image-alt` | Adds `alt=""` to `<img>` elements missing one | 1.1.1 (A) |
| `button-name` | Adds `aria-label` to nameless buttons — skips buttons with text content | 4.1.2 (A) |
| `link-name` | Adds `aria-label` to nameless links — skips links with text content | 2.4.4 (A) |
| `label` | Annotates inputs missing an associated label | 1.3.1, 4.1.2 (A) |
| `aria-label` | Annotates interactive elements without accessible names | 4.1.2 (A) |
| `html-has-lang` | Adds `lang="en"` to `<html>` elements | 3.1.1 (A) |
| `color-contrast` | Explains the issue with required contrast ratios — cannot auto-patch | 1.4.3 (AA) |
| `heading-order` | Explains the required heading hierarchy — cannot auto-patch | 1.3.1 (A) |

---

### `audit_repo`

Scans a project directory and returns a prioritised summary of violations across all files, sorted by severity.

```ts
{
  root: string;          // absolute path to project root
  baseUrl?: string;      // live dev server URL — required for TSX/JSX files
  maxFiles?: number;     // default: 20
}
```

> [!IMPORTANT]
> React and Next.js components must be rendered to produce meaningful audit results. Pass a `baseUrl` pointing at your running dev server (e.g. `http://localhost:3000`). Without `baseUrl`, only static `.html` files in the directory are audited.

---

## How the patcher works

The AST-based patcher uses [ts-morph](https://ts-morph.com) to parse and modify TypeScript/TSX source files without touching disk until explicitly asked. When `remediate` is called, violations are applied in sequence on the accumulating in-memory source — each patch receives the output of the previous one, so the final write contains all changes in a single operation.

False positives are avoided by checking element content before patching: `button-name` and `link-name` skip elements that already have visible text children and only patch elements that genuinely lack an accessible name.

Axe-core is injected from local `node_modules` rather than a CDN, so audits work in offline and firewalled environments.

---

## Tech stack

- **[Model Context Protocol TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)** — MCP server and tool registration
- **[axe-core](https://github.com/dequelabs/axe-core)** — WCAG 2.0/2.1/2.2 accessibility auditing
- **[Playwright](https://playwright.dev)** — headless Chromium for rendering live pages
- **[ts-morph](https://ts-morph.com)** — TypeScript/TSX AST manipulation
- **[Zod](https://zod.dev)** — runtime schema validation for all tool inputs

---

## Contributing

Issues and PRs are welcome.

To add a new patch strategy:

1. Add the strategy function to `src/lib/patcher.ts` and register it in `PATCH_REGISTRY` and `AUTO_FIXABLE`
2. Add plain-English guidance (headline, user impact, suggestion, before/after examples) to `VIOLATION_GUIDANCE` in `src/tools/evaluate.ts`
3. Reference the axe violation ID and WCAG criterion in both

---

## Authors

Built by [Tayyaba Taimur](https://tayyaba.dev).

---

## Licence

[MIT](./LICENSE)
