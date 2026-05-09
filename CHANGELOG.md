# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- GitHub Actions CI workflow (typecheck + build on Node 18/20/22).
- Composite GitHub Action (`action/`) for URL and repo audits with PR comments and score gating.
- ChatGPT GPT Action assets: full OpenAPI 3.1 spec (`deploy/openapi.yaml`), AI plugin manifest (`deploy/ai-plugin.json`), Fly.io deploy config (`deploy/fly.toml`).
- Hosted demo site (`web/`) for `a11y.tayyaba.dev` — paste-URL flow proxying to the Fly API via an edge route.
- Vue (`.vue`) and Svelte (`.svelte`) framework-aware patchers covering image-alt, button-name, and link-name (`src/lib/patchers/`).
- Example apps with intentional violations: `examples/static-html`, `examples/nextjs`, `examples/vue`.
- `CONTRIBUTING.md`, `SECURITY.md`, issue templates, PR template.

### Changed
- Multi-stage Dockerfile with healthcheck and prod-only runtime deps.

## [0.1.0] — 2026-05-08

### Added
- Initial public release.
- MCP server (stdio + streamable HTTP).
- CLI: `audit`, `audit:file`, `audit:repo`, `crawl`, `verify`.
- Tools: `evaluate`, `remediate`, `audit_component`, `fix_component`, `audit_repo`, `crawl_site`.
- Auto-patch strategies for image-alt, button-name, label, aria-label, link-name, color-contrast (annotation), heading-order (annotation), html-has-lang.
- Playwright auth via storage state, custom headers, basic auth.
- JSON and Markdown report export.
