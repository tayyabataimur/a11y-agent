# Next.js example

Minimal App Router page with intentional axe violations.

```sh
cd examples/nextjs
npm install
npm run dev
# in another shell
npx loop11y audit http://localhost:3000 --markdown
npx loop11y audit:repo . --max-files 5
npx loop11y remediate app/page.tsx --mode diff
```
