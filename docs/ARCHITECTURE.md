# A11yAgent Architecture Direction

## Product goal

A11yAgent should become a universal accessibility layer for any web product and any MCP-capable agent workflow.

It should support three levels of value:

1. **Evaluation** — understand accessibility issues quickly
2. **Remediation** — fix what can be safely fixed and guide the rest
3. **Enforcement** — prevent regressions in CI, PRs, and ongoing product development

---

## Core architecture layers

## 1. Evaluation layer

Inputs should expand over time to include:

- live public URL
- localhost URL
- authenticated browser session
- HTML snippet
- local HTML file
- single source file
- full repository
- sitemap / crawl target
- named user journey / flow

Outputs should be normalized into a common report model:

- score
- grade
- WCAG level estimate
- severity counts
- top issues
- quick wins
- user impact
- code examples
- stack hints
- autofix confidence

---

## 2. Remediation layer

Remediation should support multiple strategies depending on context:

- safe autofix
- diff preview
- manual fix guide
- framework-aware patch
- design recommendation
- content recommendation
- regression verification

Recommended remediation modes:

- `report`
- `diff`
- `fix-safe`
- `fix-aggressive`
- `guide-manual`
- `verify`

---

## 3. Workflow layer

A11yAgent should be usable through:

- MCP server
- CLI
- GitHub Action
- CI
- local editor integration
- hosted web UI later

The same core engine should power all surfaces.

---

## Audience-adaptive output

Every issue should be explainable for different users:

### Developer
- failing element
- rule violated
- likely file or component
- suggested patch
- confidence level

### Designer
- visual or interaction problem
- user impact
- design-level correction

### PM / founder
- severity
- affected users
- quick wins
- risk and effort summary

### Accessibility reviewer
- WCAG mapping
- evidence
- reproducibility
- verification guidance

---

## Recommended internal modules

- `core/audit` — browser + rule execution
- `core/scoring` — grade and ranking model
- `core/reports` — normalized report generation
- `core/remediation` — patch planning and execution
- `core/mapping` — map rendered failures back to source
- `integrations/mcp` — MCP tool surface
- `integrations/cli` — command-line UX
- `integrations/ci` — CI / GitHub Action adapters
- `integrations/export` — markdown, JSON, SARIF, HTML reports

---

## Near-term implementation priorities

1. stabilize current MCP flow
2. add first-class CLI
3. support more input modes beyond live URL
4. improve repo-wide scanning and source mapping
5. add report export formats
6. add no-regression verification mode

---

## Long-term differentiation

A11yAgent should not be just another accessibility scanner.

It should become the easiest way to:

- understand accessibility problems
- fix the safest issues automatically
- guide humans through the hard issues
- operationalize accessibility with agents
