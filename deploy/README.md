# Deployment

Loop11y ships in two pieces:

| Piece | Where | Why |
|-------|-------|-----|
| HTTP API + Playwright | Fly.io (`a11y-api.fly.dev`) | Vercel serverless limit (250MB unzipped) cannot fit Chromium. |
| Demo site (`web/`) | Vercel (`a11y.tayyaba.dev`) | Static + edge SSR. Calls the Fly API. |

## Backend — Fly.io

```sh
cd deploy
fly launch --copy-config --name a11y-api --dockerfile ../Dockerfile
fly deploy
```

Verify:

```sh
curl https://a11y-api.fly.dev/health
curl -X POST https://a11y-api.fly.dev/api/evaluate \
  -H 'content-type: application/json' \
  -d '{"url":"https://example.com"}'
```

## ChatGPT custom GPT

In the GPT builder, "Configure" → "Actions" → "Import from URL":

```
https://a11y-api.fly.dev/openapi.json
```

The server exposes the spec at `/openapi.json` (see `src/http/api.ts`). For static reference, see `deploy/openapi.yaml`.

Authentication: none. If you deploy a private instance, add an API key auth scheme to `openapi.yaml` and gate `handleHttpApi` behind a header check.

## Plugin manifest

`deploy/ai-plugin.json` — served at `/.well-known/ai-plugin.json` by the running server. Update `logo_url`, `contact_email`, and `api.url` if you fork or rehost.

## Demo site (frontend)

See `web/README.md`. Vercel project is linked to this monorepo with the root directory set to `web/`.
