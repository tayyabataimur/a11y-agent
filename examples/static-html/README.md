# Static HTML example

Plain HTML file with intentional axe violations: missing `lang`, missing `alt`, nameless buttons, low contrast, skipped heading level, unlabeled inputs.

## Audit

```sh
# File audit (no server needed)
npx loop11y audit:file examples/static-html/index.html --markdown

# URL audit (requires a static server)
npx serve examples/static-html
npx loop11y audit http://localhost:3000 --markdown
```

## Apply safe fixes

```sh
npx loop11y remediate examples/static-html/index.html --mode diff
npx loop11y remediate examples/static-html/index.html --mode fix
```
