# A11yAgent — Web Demo

Public demo site at **a11y.tayyaba.dev**. Paste a URL, get an instant accessibility report. Calls the hosted Fly API (`A11Y_API_URL`).

## Local dev

```sh
cd web
npm install
A11Y_API_URL=http://localhost:3000 npm run dev
# (run `node dist/index.js` from repo root in another shell to start the API)
```

## Deploy (Vercel)

1. Vercel → New Project → import this repo.
2. Set **Root Directory** to `web/`.
3. Env vars: `A11Y_API_URL=https://a11y-api.fly.dev`.
4. Add custom domain `a11y.tayyaba.dev`.

```sh
vercel link
vercel env add A11Y_API_URL production
vercel --prod
```

## Why a proxy route

`/api/audit` proxies to the Fly API so the public origin stays at `a11y.tayyaba.dev` (no CORS, no exposed backend URL in client code, easy to add rate limits later).
