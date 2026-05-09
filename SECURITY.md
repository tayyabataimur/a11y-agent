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

A11yAgent fetches and renders arbitrary URLs via Playwright. If you expose the HTTP server publicly:

- Run behind authentication or in a private network
- Restrict outbound network access from the host (block link-local, RFC1918, metadata endpoints)
- Set resource limits on the container (CPU, memory, max audit duration)
- Do not run with elevated filesystem permissions outside the workspace it audits
