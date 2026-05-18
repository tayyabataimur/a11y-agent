# Security policy

## Supported versions

The latest published version on npm is supported. Earlier versions receive fixes only at the maintainer's discretion.

## Reporting a vulnerability

Do **not** file a public GitHub issue.

Email **tayyabataimur@users.noreply.github.com** (or use GitHub's private vulnerability reporting on this repo) with:

- A description of the issue
- Steps to reproduce
- Affected version(s)
- Any known mitigations

Expect an acknowledgement within 5 business days.

## Scope

In scope:
- Code execution via crafted URLs, HTML inputs, file paths, or MCP tool arguments
- Path traversal in `audit:repo`, `audit:file`, or remediation flows
- SSRF via `evaluate` / `crawl` (the server fetches arbitrary URLs)
- Auth bypass on the HTTP/MCP server
- Prototype pollution, ReDoS in patchers
- Secret leakage in logs or reports

Out of scope:
- Issues requiring local filesystem access already granted to the operator
- Self-XSS in generated markdown reports rendered in untrusted viewers

## Operator responsibilities

Loop11y is **local-first**. The HTTP server binds to `127.0.0.1` by default, the CLI and stdio MCP transport run as the operator. See `docs/THREAT-MODEL.md` for the full model.

If you bind the HTTP server to a routable interface (`LOOP11Y_HOST=0.0.0.0` or any non-loopback address):

- Set `LOOP11Y_AUTH_TOKEN=<secret>` — required for all `/api/*` routes
- Restrict outbound network from the host (block link-local, RFC1918, metadata endpoints) to limit SSRF via `/api/evaluate`, `/api/crawl`, `/api/remediate`
- Restrict filesystem permissions — `/api/repo-audit` and `/api/remediate` read and write paths the process can access
- Set resource limits (CPU, memory, audit duration)
- Do not run with elevated filesystem permissions outside the workspace it audits
