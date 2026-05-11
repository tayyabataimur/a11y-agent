# Loop11y Integrations

## HTTP API

When `LOOP11Y_PORT` is set, Loop11y exposes both MCP and JSON HTTP endpoints.

### Endpoints

- `GET /health`
- `GET /openapi.json`
- `GET /.well-known/ai-plugin.json`
- `POST /api/evaluate`
- `POST /api/repo-audit`
- `POST /api/crawl`
- `POST /api/remediate`
- `POST /api/verify`
- `POST /mcp`

Example:

```bash
curl http://localhost:3000/api/evaluate \
  -H 'content-type: application/json' \
  -d '{"url":"https://example.com"}'
```

## ChatGPT / plugin-style config

A plugin-style manifest is available at:

```text
http://localhost:3000/.well-known/ai-plugin.json
```

OpenAPI spec:

```text
http://localhost:3000/openapi.json
```

## Generic harness SDK

Import the lightweight Node client:

```ts
import { Loop11yClient } from "loop11y/harness-sdk";

const client = new Loop11yClient({ baseUrl: "http://localhost:3000" });
const result = await client.evaluate({ url: "https://example.com" });
```

## Threshold / regression modes

CLI supports:

- `--fail-on critical`
- `--max-violations 10`
- `--baseline ./previous-report.json`

Examples:

```bash
npx loop11y audit https://example.com --json --fail-on critical
npx loop11y crawl --url https://example.com --max-pages 20 --baseline ./baseline.json
```
