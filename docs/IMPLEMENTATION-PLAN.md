# A11yAgent Implementation Plan

## Goal

Implement A11yAgent as a universal accessibility platform that works through MCP, CLI, and other agent harnesses with low-friction integration.

This plan covers:

1. CLI mode
2. sitemap / site crawl
3. plain HTML + any-framework support
4. repo-wide audit
5. safe autofix categories
6. ChatGPT plugin config
7. JSON + Markdown report export
8. harness-agnostic integration
9. before/after verification
10. issue-to-source mapping
11. localhost / dev auth flow support

---

## Product principles

- **Universal**: any site, any stack, any team
- **Low friction**: `npx`, MCP, CLI, CI, and embeddable library surfaces
- **Safe by default**: only auto-fix high-confidence issues
- **Explainable**: every issue includes user impact and fix guidance
- **Composable**: same core engine powers CLI, MCP, CI, and integrations

---

## Program structure

Ship in 4 tracks running in parallel where possible:

### Track A — Core engine
Audit, scoring, normalization, remediation, verification.

### Track B — Inputs and source mapping
URL, HTML, repo, crawl, localhost auth, framework adapters.

### Track C — Interfaces
MCP, CLI, exports, ChatGPT/plugin config, harness adapters.

### Track D — Quality and trust
Fixtures, golden reports, safety checks, benchmarks, docs.

---

## Target architecture

### Core packages / modules

- `core/audit`
  - Playwright browser management
  - axe-core injection and execution
  - authenticated session support
- `core/reporting`
  - normalized issue model
  - score / grade / WCAG estimation
  - role-specific summaries
- `core/remediation`
  - autofix registry
  - patch planner
  - confidence scoring
- `core/verify`
  - before/after re-audit
  - regression checks
- `core/mapping`
  - DOM node -> source file mapping
  - framework-aware heuristics
- `core/crawl`
  - sitemap parsing
  - queue, dedupe, rate limits, robots handling
- `integrations/mcp`
  - tool registration and schemas
- `integrations/cli`
  - commands and output formatting
- `integrations/export`
  - JSON, Markdown, later SARIF/HTML
- `integrations/harness`
  - thin wrappers for other agent runtimes

---

## Normalized issue model

Define one canonical issue schema used everywhere:

```ts
interface A11yIssue {
  id: string;
  ruleId: string;
  severity: "minor" | "moderate" | "serious" | "critical";
  wcag: string[];
  message: string;
  userImpact: string;
  help: string;
  helpUrl?: string;
  url: string;
  pageTitle?: string;
  selector: string[];
  htmlSnippets?: string[];
  screenshotRefs?: string[];
  sourceHints?: SourceHint[];
  autoFixable: boolean;
  autoFixCategory?: string;
  confidence: number;
}
```

All tools and outputs should converge on this model first.

---

# Phase plan

## Phase 0 — foundation refactor (required first)

### Purpose
Prepare codebase so all new capabilities can be added without duplicating logic.

### Deliverables
- extract core audit engine from current MCP handlers
- define normalized report model
- define remediation plan model
- separate transport layer from business logic
- add `docs/CONTRIBUTING-ARCHITECTURE.md` later

### Tasks
- move current tool logic into reusable service modules
- create shared types for reports, fixes, and verification
- create test fixtures for HTML, React, Vue, Svelte, plain pages
- create sample outputs for JSON and Markdown

### Acceptance criteria
- MCP tools call shared services, not embedded logic
- one audit flow can be invoked from both MCP and future CLI
- snapshot tests exist for normalized output

---

## Phase 1 — CLI mode + exports

### Purpose
Make A11yAgent useful without MCP and establish reporting surface.

### Commands to implement

```bash
npx a11y-agent audit <url>
npx a11y-agent audit:file <path>
npx a11y-agent audit:repo <path>
npx a11y-agent report <input.json> --format markdown
npx a11y-agent fix <source-path> --url <url>
npx a11y-agent verify <source-path> --url <url>
```

### CLI MVP features
- human-readable terminal summary
- `--json`
- `--markdown`
- `--output <file>`
- severity filtering
- exit codes for CI use

### Tasks
- add CLI entrypoint in `package.json`
- choose parser (`commander` or `yargs`)
- implement audit/fix/verify/report commands
- implement JSON and Markdown serializers
- add examples to README

### Acceptance criteria
- same URL can be audited through MCP or CLI with consistent results
- reports can be exported to JSON and Markdown
- CLI returns non-zero on configurable thresholds

Dependencies: Phase 0

---

## Phase 2 — plain HTML + any-framework support

### Purpose
Broaden beyond TSX-centric flows.

### Scope
- plain HTML files
- static templates
- React / Next.js
- Vue SFC templates
- Svelte components
- Angular templates
- generic rendered-app fallback for unknown stacks

### Implementation strategy
Use a layered approach:

#### Layer 1: rendered audit (universal)
Everything that can render in a browser is auditable.

#### Layer 2: source-level patchers
Add stack-specific patch adapters only where safe.

#### Layer 3: manual fix guides
If patching is unsafe, return file hints + human guidance.

### Tasks
- create source adapter interface:

```ts
interface SourceAdapter {
  name: string;
  detect(files: string[]): boolean;
  patch(issue: A11yIssue, file: string): PatchResult | null;
  locate?(issue: A11yIssue, repo: string): SourceHint[];
}
```

- build adapters for:
  - HTML
  - JSX/TSX
  - Vue templates
  - Svelte templates
  - Angular templates
- add fallback generic adapter for unknown frameworks

### Acceptance criteria
- audit works on any rendered app
- fix guidance works even when patching is unsupported
- safe autofixes succeed on HTML and at least one non-React framework

Dependencies: Phase 0, Phase 1

---

## Phase 3 — repo-wide audit + issue-to-source mapping

### Purpose
Audit real repositories, not just single files.

### Repo audit outputs
- summary by severity
- summary by page / route / file
- top recurring issue classes
- likely source files
- quick wins backlog

### Implementation strategy
Repo audit should combine:
- file discovery
- stack detection
- dev server / rendered page association
- static template scanning where rendering is unavailable
- source mapping heuristics

### Source mapping strategies
Use multiple heuristics in order:

1. explicit `source_path` provided by user
2. route/file conventions (`app/`, `pages/`, router maps)
3. unique class/id/text matching in source
4. component name inference
5. source maps when available
6. framework build artifacts / devtools markers
7. git blame / file ownership later

### Tasks
- build repo walker with include/exclude rules
- detect frameworks from config files
- create route-to-file mapping for common frameworks
- map DOM snippets/selectors back to likely files
- return confidence score and candidate files

### Acceptance criteria
- repo audit produces prioritized multi-file report
- at least top 3 common frameworks have useful source hints
- source mapping returns confidence and fallback guidance

Dependencies: Phase 2

---

## Phase 4 — sitemap/site crawl

### Purpose
Allow full-site accessibility discovery.

### Crawl modes
- `crawl --url https://site.com`
- `crawl --sitemap https://site.com/sitemap.xml`
- `crawl --start-url ... --max-pages 100`
- authenticated crawl for staging / app flows

### Core requirements
- queue + dedupe
- same-origin restriction by default
- robots and rate limit handling
- concurrency control
- page grouping by template/signature
- route sampling to reduce duplicates

### Tasks
- parse sitemap XML
- discover links from rendered pages
- create crawl queue manager
- cluster similar pages by DOM/template signature
- aggregate repeated issues
- export crawl-level reports

### Acceptance criteria
- crawl can audit a sitemap and produce aggregate report
- duplicate template pages are grouped
- crawl can stop at thresholds and resume later

Dependencies: Phase 1, Phase 3

---

## Phase 5 — safe autofix categories

### Purpose
Expand remediation safely and transparently.

### Principle
Autofix by category, not by ad hoc rule handling.

### Initial safe autofix categories
- missing image alt attributes
- unnamed buttons
- unnamed links
- form control labeling hints / safe annotations
- missing `lang` attribute
- landmark suggestions where unambiguous
- duplicate-id detection guidance
- heading structure annotations (guidance-only if unsafe)
- focusable element naming hints

### Classification
For every category assign:
- `safe-autofix`
- `guided-fix`
- `manual-only`

### Tasks
- formalize autofix registry
- add confidence scoring per fix
- record change rationale in diff output
- add dry-run + review mode
- add verification hook after patch

### Acceptance criteria
- every autofix declares safety level and rollback path
- no write happens without patch summary
- post-fix verification reruns automatically in `fix` mode when possible

Dependencies: Phase 2, Phase 3

---

## Phase 6 — before/after verification

### Purpose
Prove fixes actually improved accessibility.

### Verification outputs
- score delta
- issues fixed
- issues remaining
- regressions introduced
- pages requiring manual recheck

### Tasks
- build `verify` service
- compare audit results pre/post patch
- attach verification summary to CLI and MCP `fix` flows
- add screenshot diff hook later for visual spot checks

### Acceptance criteria
- every `fix` can optionally rerun audit and report deltas
- verification clearly separates resolved vs unresolved issues

Dependencies: Phase 1, Phase 5

---

## Phase 7 — localhost / dev auth flow support

### Purpose
Support real products hidden behind auth, feature flags, and dev flows.

### Support targets
- localhost URLs
- cookies / session reuse
- custom headers
- login scripts
- bearer tokens
- basic auth
- saved Playwright storage state

### Tasks
- add auth config schema
- accept storage state file path
- support pre-audit login script
- support custom headers and cookies
- document secure secret handling

### Suggested config model

```json
{
  "auth": {
    "storageState": "./playwright/.auth/user.json",
    "headers": { "x-env": "staging" },
    "basicAuth": { "username": "", "password": "" }
  }
}
```

### Acceptance criteria
- users can audit logged-in app pages locally
- crawl can reuse authenticated state
- secrets are never printed in reports

Dependencies: Phase 0, Phase 4

---

## Phase 8 — ChatGPT plugin config + harness-agnostic integration

### Purpose
Make A11yAgent usable in more agent environments than MCP alone.

### Reality check
Different harnesses support different integration models:
- MCP
- stdio tools
- HTTP tools
- OpenAPI / plugin-like manifests
- custom SDK wrappers

### Strategy
Support them via a shared service boundary.

### Deliverables
- MCP config examples
- HTTP server mode stable enough for hosted tool use
- OpenAPI spec for HTTP endpoints
- `ai-plugin.json` / manifest-style config if needed by target platform
- small JS/TS SDK wrapper for harness authors

### Harness adapter targets
- ChatGPT-compatible HTTP tool surface
- Claude / Cursor / Cline via MCP
- generic agent harness via Node API
- CI via CLI

### Tasks
- define stable HTTP endpoints:
  - `/health`
  - `/audit`
  - `/fix`
  - `/verify`
  - `/crawl`
- add OpenAPI schema
- create `docs/INTEGRATIONS.md`
- create examples for:
  - MCP config
  - ChatGPT/plugin-style config
  - direct Node usage
  - Docker deployment

### Acceptance criteria
- same core actions are callable via MCP, CLI, and HTTP
- harness authors can integrate without reading internal code
- hosted mode has deterministic request/response schema

Dependencies: Phase 1, Phase 6

---

## Phase 9 — quality, safety, and docs hardening

### Purpose
Make project trustworthy as open source infra.

### Tasks
- fixture repos for multiple frameworks
- golden result snapshots
- integration tests for crawl/auth/fix/verify
- performance benchmarks
- contribution guide for new adapters and fixers
- security notes for auth and hosted mode

### Acceptance criteria
- matrix tests pass across sample apps
- contributors can add a new framework adapter with docs
- docs cover local, MCP, CLI, HTTP, and CI usage

Dependencies: all previous phases

---

# Recommended tool/API evolution

## MCP tools to keep or add

### Keep
- `evaluate`
- `remediate`
- `audit_component`
- `fix_component`
- `audit_repo`

### Add
- `crawl_site`
- `evaluate_html`
- `verify_remediation`
- `export_report`
- `map_issue_to_source`

---

## CLI commands to expose

```bash
a11y-agent audit <url>
a11y-agent audit:file <path>
a11y-agent audit:repo <path>
a11y-agent crawl <url>
a11y-agent fix <source>
a11y-agent verify <source>
a11y-agent export <report.json> --format markdown
```

---

# Execution order

## Recommended order of implementation

1. Phase 0 foundation refactor
2. Phase 1 CLI + export
3. Phase 2 universal input/support layers
4. Phase 3 repo audit + source mapping
5. Phase 5 safe autofixes
6. Phase 6 verification
7. Phase 4 crawl
8. Phase 7 auth / localhost flows
9. Phase 8 harness adapters / ChatGPT config
10. Phase 9 hardening

Reason:
- CLI and normalized outputs unlock testing and adoption early
- source support and repo audit are prerequisites for real remediation
- crawl and auth become much easier once core engine is stable
- harness adapters should wrap stable APIs, not moving internals

---

# Milestone view

## Milestone A — usable universal beta
Includes:
- CLI mode
- JSON/Markdown export
- plain HTML support
- improved repo audit
- basic verification

## Milestone B — multi-framework remediation beta
Includes:
- HTML + JSX/TSX + one additional framework adapter
- safe autofix registry
- issue-to-source mapping
- before/after verification

## Milestone C — full workflow beta
Includes:
- crawl
- localhost auth flows
- HTTP/OpenAPI integration
- harness-agnostic adapters

## Milestone D — world-class OSS release
Includes:
- docs hardening
- framework matrix
- CI/GitHub integration
- strong examples and fixtures

---

# Risks and mitigation

## Risk: source mapping is unreliable
Mitigation:
- always return confidence score
- show candidate files
- fall back to manual guidance

## Risk: autofixes break apps
Mitigation:
- safe-by-default categories
- diff mode first
- verification rerun
- no aggressive writes by default

## Risk: framework-specific complexity explodes
Mitigation:
- adapter interface
- universal rendered audit first
- incremental framework support

## Risk: hosted mode auth is sensitive
Mitigation:
- local-first auth support
- secure secrets docs
- never persist secrets in reports

---

# Immediate next sprint

## Sprint 1
- Phase 0 foundation refactor
- define normalized report schema
- extract shared audit service
- scaffold CLI entrypoint
- implement JSON export

## Sprint 2
- implement Markdown export
- add `audit` and `audit:file`
- add `verify` command skeleton
- add HTML adapter

## Sprint 3
- improve `audit_repo`
- add repo walker and stack detection
- add source-hint model
- add first mapping heuristics

## Sprint 4
- add autofix registry formalization
- verification rerun support
- add one non-React adapter

---

# Definition of success

A11yAgent is successful when:

- a non-expert can audit a product in minutes
- a developer can get patch previews without deep setup
- a team can run it in CI and on localhost
- an AI harness can call it through MCP, CLI, or HTTP
- results are understandable, actionable, and safe
