# Vue 3 example

Single-file component with intentional axe violations. Validates the Vue patcher in `src/lib/patchers/vue.ts`.

```sh
cd examples/vue
npm install
npm run dev
# in another shell
npx loop11y audit http://localhost:3000 --markdown
npx loop11y remediate src/App.vue --mode diff
```
