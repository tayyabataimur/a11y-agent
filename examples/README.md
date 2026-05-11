# Examples

Minimal apps with intentional accessibility issues for testing Loop11y.

| Example | Stack | What it shows |
|---------|-------|---------------|
| [`static-html`](./static-html) | Plain HTML | Missing alt, nameless buttons, no lang, low contrast |
| [`nextjs`](./nextjs) | Next.js (App Router) | TSX component with several axe violations |
| [`vue`](./vue) | Vue 3 SFC | Vue template with image/button/link issues |

## Run an audit on any example

```sh
# URL audit (run the example, then point loop11y at it)
npx loop11y audit http://localhost:3000

# File audit
npx loop11y audit:file examples/static-html/index.html

# Repo audit
npx loop11y audit:repo examples/nextjs --max-files 10
```

## Generate fixes

```sh
npx loop11y remediate examples/static-html/index.html --mode diff
npx loop11y fix_component examples/nextjs/app/page.tsx image-alt
```
