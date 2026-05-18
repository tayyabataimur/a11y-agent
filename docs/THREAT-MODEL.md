# loop11y Threat Model

loop11y is designed as a **local-first** developer tool. It audits, patches, and verifies accessibility against URLs and source files supplied by an operator. Most operators run it via the CLI, the MCP stdio transport, or a self-hosted HTTP server bound to `127.0.0.1`. The threat model below assumes that posture and calls out the cases where it changes.

## Trust boundary

| Caller | Trust level | Notes |
|---|---|---|
| Local CLI / stdio MCP | Trusted | Same uid as operator, same FS access. |
| HTTP server on `127.0.0.1` | Trusted | Only reachable to processes on the same host. Default since 0.2. |
| HTTP server on a routable interface | **Untrusted** | Treat as exposed to anyone who can reach the port. Requires `LOOP11Y_AUTH_TOKEN`. |
| GitHub Action runner | Trusted, but ephemeral | Runs in CI sandbox, sees `GITHUB_TOKEN` and repo contents. |

## Sensitive HTTP routes

The HTTP server in `src/http/api.ts` and `src/mcp/server.ts` exposes the following routes. All of them accept operator-supplied inputs (URLs, file paths, repo paths) and execute privileged operations.

- **`POST /api/evaluate`** — Fetches and renders an arbitrary URL with Playwright. **SSRF risk**: the server will perform requests on behalf of the caller. If the host has access to internal networks, cloud metadata endpoints (`169.254.169.254`), or RFC1918 ranges, those URLs can be probed. Mitigations: block egress at the host or container, set `LOOP11Y_AUTH_TOKEN`, or run only on `127.0.0.1`.
- **`POST /api/crawl`** — Same as `/evaluate`, but multi-page and recursive. Amplifies SSRF surface and resource cost.
- **`POST /api/repo-audit`** — Reads files from a caller-supplied `path`. **Path traversal / arbitrary file read risk**: the server walks any directory the operator can read. Do not expose this route to untrusted callers.
- **`POST /api/remediate`** — Audits a URL **and writes patched source back to disk** when `mode: "fix"`. Combines SSRF + arbitrary file write within the operator's FS permissions. The destructive write path is gated by `mode`, not by network policy.
- **`POST /api/verify`** — Re-audits a URL and reads a source file. SSRF + arbitrary file read.

## Risky autofix surfaces

Some patch strategies satisfy automated checks but require human judgment to be correct. They are tagged `safety: "guided-fix"` in `PATCH_REGISTRY` and are **not** applied by default. Pass `apply_drafts: true` to `/api/remediate` or the `remediate` MCP tool to opt in.

- `image-alt` — inserts `alt=""`. Correct for decorative images, wrong for informative ones.
- `button-name` — inserts a placeholder `aria-label`. Screen-reader users hear the placeholder.
- `link-name` — same placeholder behaviour for anchors.

Without `apply_drafts`, these violations appear in `needs_manual` with the suggested patch text so a human can decide.

## Operator responsibilities

If you run the HTTP server anywhere other than `127.0.0.1`:

1. **Require authentication.** Set `LOOP11Y_AUTH_TOKEN` to a secret value. The server rejects non-`/health` requests without a matching `Authorization: Bearer <token>` header.
2. **Restrict outbound network.** Block link-local (`169.254.0.0/16`), RFC1918 (`10/8`, `172.16/12`, `192.168/16`), and metadata endpoints (`169.254.169.254`, `fd00:ec2::254`).
3. **Restrict filesystem.** Run as a least-privilege user in a container; mount only the workspace you intend to audit.
4. **Set resource limits.** CPU, memory, and audit duration caps prevent Playwright fan-out from exhausting the host.
5. **Do not expose `/api/repo-audit` or `/api/remediate` to multi-tenant traffic.** They were designed for the same operator that started the server.

## Hosted deployments

The current code does not include rate limiting, audit logging, per-tenant isolation, or sandboxing of patched files. If you build a hosted service on top of loop11y, you must add those layers yourself. The license disclaims warranty; the threat model above is the floor, not the ceiling.

## Reporting

See `SECURITY.md` for the disclosure channel.
