<div align="center">

# Loop11y

**Agentic accessibility auditing, remediation, and enforcement for any web product**

[![CI](https://github.com/tayyabataimur/loop11y/actions/workflows/ci.yml/badge.svg)](https://github.com/tayyabataimur/loop11y/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](https://opensource.org/licenses/MIT)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-compatible-blue)](https://modelcontextprotocol.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript)](https://www.typescriptlang.org)
[![Powered by axe-core](https://img.shields.io/badge/powered%20by-axe--core-orange)](https://github.com/dequelabs/axe-core)

[Quick start](#quick-start) · [Who it's for](#who-its-for) · [Current capabilities](#current-capabilities) · [Integrations](#integrations)

</div>

---

**Loop11y** is a universal accessibility layer for humans and AI agents.

It helps teams **evaluate**, **explain**, **prioritize**, **remediate**, and eventually **enforce** accessibility across websites and web apps with the lowest possible setup friction.

Most accessibility tools stop at detection. Loop11y is being built to close the loop:

- audit a live experience
- explain what failed in plain language
- identify quick wins
- generate patch previews
- apply safe fixes
- rerun and verify improvements

## Vision

Make accessibility improvement as easy as running a URL through an agent.

Loop11y is not meant to be only for React or Next.js teams. The goal is to become the easiest accessibility workflow for:

- developers
- designers
- QA teams
- founders and PMs
- agencies
- accessibility specialists
- AI assistants using MCP

across:

- static sites
- SPAs
- design systems
- e-commerce products
- dashboards
- docs sites
- React / Next.js / Vue / Svelte / Angular / plain HTML

## Who it's for

### Developers
Get actionable violations, code examples, patch previews, and safe autofixes.

### Designers
Understand user impact, hierarchy issues, naming issues, contrast problems, and interaction gaps.

### QA and accessibility reviewers
Run repeatable audits, compare results, and produce shareable reports.

### AI agents and MCP clients
Use Loop11y as an accessibility copilot inside Claude, Cursor, Copilot, Cline, and other MCP-compatible tools.

## Quick start

### MCP setup

Add to Claude Desktop, Claude Code, Cursor, Cline, or any MCP client:

```json
{
  "mcpServers": {
    "loop11y": {
      "command": "npx",
      "args": ["-y", "loop11y"]
    }
  }
}
```

### Local run

```sh
npm install
npx playwright install chromium
npm run build
node dist/index.js
```

### CLI examples

```sh
npx loop11y audit https://example.com --markdown
npx loop11y audit:file ./index.html --output ./report.md
npx loop11y audit:repo . --max-files 10 --output ./repo-report.json
npx loop11y crawl --url https://example.com --max-pages 10 --markdown
npx loop11y verify ./src/App.tsx --url http://localhost:3000 --markdown
npx loop11y audit http://localhost:3000/dashboard --storage-state ./playwright/.auth/user.json --header 'x-env: staging'
```

### HTTP mode

```sh
LOOP11Y_PORT=3000 npx loop11y
# MCP endpoint:        http://localhost:3000/mcp
# Health check:        http://localhost:3000/health
# OpenAPI spec:        http://localhost:3000/openapi.json
# Plugin-style config: http://localhost:3000/.well-known/ai-plugin.json
# JSON API:            http://localhost:3000/api/evaluate
```

### Docker

```sh
docker build -t loop11y .
docker run -p 3000:3000 -e LOOP11Y_PORT=3000 loop11y
```

> [!NOTE]
> Hosted mode can audit public URLs. For localhost and private dev environments, use local stdio MCP mode.

## Integrations

Loop11y is designed to become frictionless across multiple surfaces:

### Available now
- MCP server via `npx loop11y`
- local stdio mode for AI assistants
- streamable HTTP server mode
- JSON HTTP API + OpenAPI + plugin-style manifest
- live URL evaluation
- CLI commands for `audit`, `audit:file`, `audit:repo`, `crawl`, and `verify`
- localhost/dev auth support via Playwright storage state, custom headers, and basic auth
- JSON and Markdown report export
- repo and source-file remediation workflows

### Planned
- additional CLI commands like `check`, `fix`, and `report`
- richer regression policies and CI-first fail rules
- GitHub Action for CI and pull requests
- site crawling and regression checks
- stack-aware patchers beyond TSX/JSX
- hosted dashboard for non-technical teams

## Current capabilities

Loop11y today already supports the core agentic loop:

1. **Evaluate** a live URL
2. **Rank** issues by severity and impact
3. **Explain** failures in plain English
4. **Preview** a remediation diff
5. **Apply** safe fixes to source files

### Current tools

#### `evaluate`
Audits a live URL and returns:
- accessibility score
- grade
- estimated WCAG level
- ranked issues
- quick wins
- plain-language AI summary

#### `remediate`
Runs audit + remediation in three modes:
- `report`
- `diff`
- `fix`

#### `audit_component`
Returns raw axe-core violations for a single page or HTML file.

#### `fix_component`
Applies a single known fix strategy to a source file.

#### `audit_repo`
Scans a project and returns a prioritized accessibility summary.

## Current scope vs future scope

### Current scope
The implementation is strongest today for:
- rendered URL auditing
- local development workflows
- TSX / JSX / HTML source remediation
- React and Next.js-oriented patch workflows

### Future scope
The product direction is broader:
- any web stack
- any user role
- any integration surface
- any stage of the delivery lifecycle

That means evolving from a patcher into a universal accessibility platform with:
- evaluation
- remediation
- workflow automation
- continuous enforcement

## Example workflow

```text
evaluate("https://example.com")
  -> score, grade, ranked issues, quick wins

remediate(source, url, mode="diff")
  -> preview before/after patch

remediate(source, url, mode="fix")
  -> write safe fixes to disk
```

## Design principles

### 1. Detection is not enough
Reports should lead to remediation.

### 2. Low friction wins
Loop11y should work with `npx`, MCP, CI, and simple local workflows.

### 3. Explain for different audiences
The same issue should be understandable by a developer, designer, PM, or founder.

### 4. Safe automation over risky automation
Autofix only what can be fixed confidently. Escalate the rest with clear guidance.

### 5. Human + AI collaboration
Agents should assist, not hide tradeoffs. Diffs, confidence, and manual follow-up matter.

See also:
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- [docs/ROADMAP.md](./docs/ROADMAP.md)

## Tech stack

- **[Model Context Protocol TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)** — MCP server and tool registration
- **[axe-core](https://github.com/dequelabs/axe-core)** — accessibility rule engine
- **[Playwright](https://playwright.dev)** — rendering and browser automation
- **[ts-morph](https://ts-morph.com)** — AST-based source transforms
- **[Zod](https://zod.dev)** — runtime schema validation

## Contributing

Issues and PRs are welcome.

High-impact contribution areas:
- new stack-aware fixers
- better issue-to-source mapping
- crawl and report tooling
- safer autofix strategies
- role-specific reporting
- CI and GitHub integrations

## Author

Built by [Tayyaba Taimur](https://tayyaba.dev).

## Licence

[MIT](./LICENSE)
