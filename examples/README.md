# Examples

Minimal apps with intentional accessibility issues for testing A11yAgent.

| Example | Stack | What it shows |
|---------|-------|---------------|
| [`static-html`](./static-html) | Plain HTML | Missing alt, nameless buttons, no lang, low contrast |
| [`nextjs`](./nextjs) | Next.js (App Router) | TSX component with several axe violations |
| [`vue`](./vue) | Vue 3 SFC | Vue template with image/button/link issues |

## Run an audit on any example

```sh
# URL audit (run the example, then point a11y-agent at it)
npx a11y-agent audit http://localhost:3000

# File audit
npx a11y-agent audit:file examples/static-html/index.html

# Repo audit
npx a11y-agent audit:repo examples/nextjs --max-files 10
```

## Generate fixes

```sh
npx a11y-agent remediate examples/static-html/index.html --mode diff
npx a11y-agent fix_component examples/nextjs/app/page.tsx image-alt
```
