# Loop11y Roadmap

## North star

Make accessibility improvement feel as simple as asking an agent:

> Evaluate my product, explain what matters, fix what is safe, and help me close the rest.

---

## Phase 1 — strengthen the foundation

### Goals
- make current MCP workflow reliable
- improve docs and onboarding
- clarify product direction beyond React / Next.js

### Deliverables
- universal positioning in README
- cleaner installation and integration docs
- better output examples
- stronger repo-level documentation

---

## Phase 2 — universal evaluation

### Goals
Support more ways to audit products.

### Deliverables
- `evaluate_url`
- `evaluate_html`
- `evaluate_file`
- improved `audit_repo`
- markdown and JSON report export
- better localhost guidance

### Success metric
A first-time user can evaluate a product in under 5 minutes.

---

## Phase 3 — universal remediation

### Goals
Expand beyond TSX-centric fixes.

### Deliverables
- HTML patcher improvements
- Vue template support
- Svelte support
- Angular template support
- manual remediation guides for non-autofixable issues
- before/after verification

### Success metric
Loop11y can improve accessibility in mixed-stack repositories, not just React-oriented ones.

---

## Phase 4 — frictionless workflows

### Goals
Meet users where they already work.

### Deliverables
- first-class CLI
- GitHub Action
- CI fail thresholds
- no-regression mode
- pull request summaries
- sitemap crawling
- critical flow auditing

### Success metric
Teams can run Loop11y in local development and CI without custom glue code.

---

## Phase 5 — accessibility operations

### Goals
Help teams scale accessibility practice over time.

### Deliverables
- trend tracking
- backlog generation
- report export for stakeholders
- policy and threshold enforcement
- accessibility score comparisons over time

### Success metric
Loop11y becomes part of product delivery, not a one-off audit tool.

---

## Contribution wishlist

High-value contributions:

- additional autofix strategies
- improved issue ranking
- framework-specific source mapping
- CLI UX design
- CI / GitHub Action support
- report export formats
- sample projects across stacks
