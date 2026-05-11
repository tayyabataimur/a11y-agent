# A11yAgent Integrations

## HTTP API

When `A11Y_AGENT_PORT` is set, A11yAgent exposes both MCP and JSON HTTP endpoints.

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
import { A11yAgentClient } from "a11y-agent/harness-sdk";

const client = new A11yAgentClient({ baseUrl: "http://localhost:3000" });
const result = await client.evaluate({ url: "https://example.com" });
```

## Threshold / regression modes

CLI supports:

- `--fail-on critical`
- `--max-violations 10`
- `--baseline ./previous-report.json`

Examples:

```bash
npx a11y-agent audit https://example.com --json --fail-on critical
npx a11y-agent crawl --url https://example.com --max-pages 20 --baseline ./baseline.json
```
