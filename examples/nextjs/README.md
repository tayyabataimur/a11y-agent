# Next.js example

Minimal App Router page with intentional axe violations.

```sh
cd examples/nextjs
npm install
npm run dev
# in another shell
npx a11y-agent audit http://localhost:3000 --markdown
npx a11y-agent audit:repo . --max-files 5
npx a11y-agent remediate app/page.tsx --mode diff
```
