<div align="center">

# Loop11y

**Agentic accessibility auditing, remediation, and enforcement for any web product**

[![npm](https://img.shields.io/npm/v/loop11y)](https://www.npmjs.com/package/loop11y)
[![npm downloads](https://img.shields.io/npm/dm/loop11y)](https://www.npmjs.com/package/loop11y)
[![CI](https://github.com/tayyabataimur/loop11y/actions/workflows/ci.yml/badge.svg)](https://github.com/tayyabataimur/loop11y/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](https://opensource.org/licenses/MIT)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-compatible-blue)](https://modelcontextprotocol.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript)](https://www.typescriptlang.org)
[![Powered by axe-core](https://img.shields.io/badge/powered%20by-axe--core-orange)](https://github.com/dequelabs/axe-core)

[Use it](#use-it) · [Who it's for](#who-its-for) · [Tools](#tools) · [Capabilities](#capabilities)

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

## Use it

Loop11y meets you where you build. Pick a path:

| You are... | Surface | Setup time |
|---|---|---|
| Coding with Claude / Cursor / Cline / Copilot | [MCP server](#1-mcp-server-claude-cursor-cline-copilot) | 30s |
| Using Claude with a guided skill | [Claude skill bundle](#2-claude-skill-bundle) | 1 min |
| In the terminal | [CLI](#3-cli) | 10s |
| Building a custom agent or GPT | [HTTP API + OpenAPI](#4-http-api--openapi--chatgpt-gpt-action) | 1 min |
| Gating PRs in CI | [GitHub Action](#5-github-action) | 2 min |
| Embedding in your own code | [Harness SDK](#6-harness-sdk-programmatic) | 1 min |
| Self-hosting | [Docker / Fly](#7-self-host-docker--fly) | 5 min |

> [!NOTE]
> All paths share the same toolset (`evaluate`, `remediate`, `audit_component`, `audit_repo`, `crawl_site`, `fix_component`). Choose by surface, not capability.

### 1. MCP server (Claude, Cursor, Cline, Copilot)

Add to your MCP client config:

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

Restart the client. Ask: *"Evaluate https://example.com for accessibility issues."*

Config paths:
- **Claude Desktop**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Claude Code**: `~/.claude/settings.json` → `mcpServers`
- **Cursor**: Settings → MCP
- **Cline**: VS Code settings → `cline.mcpServers`

### 2. Claude skill bundle

Adds guided prompting on top of the MCP server (auto-triggers on a11y keywords, runs tools in the right order).

1. Install MCP server (path 1 above)
2. Download `skill.skill` from the [latest release](https://github.com/tayyabataimur/loop11y/releases/latest)
3. Drop into Claude skills directory or upload via Claude.ai UI

### 3. CLI

```sh
npm i -g loop11y
# or run on demand:
npx -y loop11y <command>
```

Common commands:

```sh
loop11y audit https://example.com --markdown
loop11y audit:file ./index.html --output ./report.md
loop11y audit:repo . --max-files 10 --output ./repo-report.json
loop11y crawl --url https://example.com --max-pages 10 --markdown
loop11y verify ./src/App.tsx --url http://localhost:3000 --markdown

# auth for protected dev environments
loop11y audit http://localhost:3000/dashboard \
  --storage-state ./playwright/.auth/user.json \
  --header 'x-env: staging'
```

### 4. HTTP API + OpenAPI + ChatGPT GPT Action

Run as HTTP server:

```sh
LOOP11Y_PORT=3000 npx loop11y
```

Endpoints:
- `POST /api/evaluate` — JSON API for any agent / workflow tool
- `GET  /openapi.json` — OpenAPI 3 spec (drop into ChatGPT GPT Action, n8n, Zapier, custom agent)
- `GET  /.well-known/ai-plugin.json` — plugin manifest
- `POST /mcp` — streamable HTTP MCP transport
- `GET  /health` — liveness check

Example:
```sh
curl -X POST localhost:3000/api/evaluate \
  -H 'content-type: application/json' \
  -d '{"url":"https://example.com"}'
```

### 5. GitHub Action

Gate PRs on accessibility regressions.

```yaml
# .github/workflows/a11y.yml
- uses: tayyabataimur/loop11y/action@v0.1.0
  with:
    url: https://staging.example.com
    fail-on: serious
    max-violations: 10
```

PR comment + check status auto-generated. See [action/README.md](./action/README.md).

### 6. Harness SDK (programmatic)

For agents and apps that talk to a running HTTP instance:

```ts
import { Loop11yClient } from "loop11y/harness-sdk";

const client = new Loop11yClient({ baseUrl: "http://localhost:3000" });
const report = await client.evaluate({ url: "https://example.com" });
console.log(report.score, report.ai_summary);
```

### 7. Self-host (Docker / Fly)

Docker:
```sh
docker build -t loop11y .
docker run -p 3000:3000 -e LOOP11Y_PORT=3000 loop11y
```

Fly:
```sh
fly launch --config deploy/fly.toml
fly deploy
```

> [!NOTE]
> Hosted mode audits public URLs. For localhost or private dev environments, use local stdio MCP (path 1) or local CLI (path 3).

## Local development

```sh
git clone https://github.com/tayyabataimur/loop11y.git
cd loop11y
npm install
npx playwright install chromium
npm run build
node dist/index.js
```

## Capabilities

Loop11y supports the core agentic loop:

1. **Evaluate** a live URL
2. **Rank** issues by severity and impact
3. **Explain** failures in plain English
4. **Preview** a remediation diff
5. **Apply** safe fixes to source files

## Tools

### `evaluate`
Audits a live URL and returns:
- accessibility score
- grade
- estimated WCAG level
- ranked issues
- quick wins
- plain-language AI summary

### `remediate`
Runs audit + remediation in three modes:
- `report`
- `diff`
- `fix`

### `audit_component`
Returns raw axe-core violations for a single page or HTML file.

### `fix_component`
Applies a single known fix strategy to a source file.

### `audit_repo`
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
