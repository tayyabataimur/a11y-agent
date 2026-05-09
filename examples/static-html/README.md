# Static HTML example

Plain HTML file with intentional axe violations: missing `lang`, missing `alt`, nameless buttons, low contrast, skipped heading level, unlabeled inputs.

## Audit

```sh
# File audit (no server needed)
npx a11y-agent audit:file examples/static-html/index.html --markdown

# URL audit (requires a static server)
npx serve examples/static-html
npx a11y-agent audit http://localhost:3000 --markdown
```

## Apply safe fixes

```sh
npx a11y-agent remediate examples/static-html/index.html --mode diff
npx a11y-agent remediate examples/static-html/index.html --mode fix
```
