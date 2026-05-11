# Contributing to Loop11y

Thanks for your interest! This project aims to make accessibility improvement frictionless across stacks and surfaces.

## Quick start

```sh
git clone https://github.com/tayyabataimur/loop11y
cd loop11y
npm install
npx playwright install chromium
npm run typecheck
npm run build
node dist/index.js audit https://example.com
```

## Project layout

| Path | What |
|------|------|
| `src/` | MCP server, CLI, core services, axe runner, patchers |
| `src/lib/patchers/` | Framework-aware autofixers (Vue, Svelte, plus the core TSX/HTML strategies in `src/lib/patcher.ts`) |
| `action/` | GitHub Action (composite) |
| `web/` | Next.js demo at a11y.tayyaba.dev |
| `deploy/` | OpenAPI spec, AI plugin manifest, Fly.io config |
| `examples/` | Apps with intentional violations for testing |
| `docs/` | Architecture, roadmap, implementation plan |

## Workflows

**Bug fix:** open an issue first if it's non-obvious. Reference it in the PR.

**New autofixer:** add a strategy under `src/lib/patcher.ts` (or `src/lib/patchers/<framework>.ts` for framework-specific). Register it. Include before/after examples in the PR.

**Framework support:** add `src/lib/patchers/<framework>.ts` exporting a `<FRAMEWORK>_PATCHERS` map and a file-detection helper. Wire into `tryFrameworkPatch`.

**New tool:** add to `src/tools/`, register in `src/mcp/server.ts` and `src/integrations/cli.ts`, and document in `README.md`.

## High-impact areas

- Stack-aware fixers (Angular, Astro, plain JS)
- Better source mapping from rendered DOM issue → code location
- Crawl + report tooling (sitemap, link graph)
- Safer autofix strategies (color-contrast, heading-order)
- Role-specific reporting (designer, PM, QA views)
- CI / GitHub integrations

## PR checklist

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] CLI smoke test (audit a known URL or example)
- [ ] README / docs updated if the public surface changed
- [ ] CHANGELOG.md entry under `## Unreleased`

## Code style

- TypeScript strict. No `any` unless justified in a comment.
- Named exports preferred over default.
- Avoid premature abstraction. Three similar lines beats a wrong abstraction.
- Comments explain *why*, not *what*.

## Reporting bugs

Use the bug report template. Include:
- Loop11y version (`npx loop11y --version`)
- Node version
- OS
- Minimal reproduction (URL or file)
- Expected vs actual output

## Security

See [SECURITY.md](./SECURITY.md). Do not file public issues for security reports.
