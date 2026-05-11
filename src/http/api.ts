import type http from "node:http";
import { evaluate, evaluateSchema } from "../tools/evaluate.js";
import { auditRepo, auditRepoSchema } from "../tools/scan.js";
import { crawlSite, crawlSiteSchema } from "../tools/crawl.js";
import { remediate, remediateSchema } from "../tools/remediate.js";
import { verifyRemediation } from "../core/verify-service.js";
import { authConfigSchema } from "../core/auth.js";
import { z } from "zod";

const verifyHttpSchema = z.object({
  source_path: z.string(),
  audit_url: z.string(),
  auth: authConfigSchema.optional(),
});

export function buildOpenApiSpec(port: number): Record<string, unknown> {
  const serverUrl = `http://localhost:${port}`;
  return {
    openapi: "3.1.0",
    info: {
      title: "Loop11y HTTP API",
      version: "0.1.0",
      description: "HTTP API for accessibility evaluation, crawl, repo audit, remediation, and verification.",
    },
    servers: [{ url: serverUrl }],
    paths: {
      "/health": { get: { summary: "Health check", responses: { "200": { description: "OK" } } } },
      "/openapi.json": { get: { summary: "OpenAPI spec", responses: { "200": { description: "OpenAPI document" } } } },
      "/api/evaluate": { post: { summary: "Evaluate a page", requestBody: { required: true }, responses: { "200": { description: "Evaluation result" } } } },
      "/api/repo-audit": { post: { summary: "Audit a repository", requestBody: { required: true }, responses: { "200": { description: "Repo audit result" } } } },
      "/api/crawl": { post: { summary: "Crawl a site", requestBody: { required: true }, responses: { "200": { description: "Crawl result" } } } },
      "/api/remediate": { post: { summary: "Remediate accessibility issues", requestBody: { required: true }, responses: { "200": { description: "Remediation result" } } } },
      "/api/verify": { post: { summary: "Verify remediation", requestBody: { required: true }, responses: { "200": { description: "Verification result" } } } },
    },
  };
}

export function buildPluginManifest(port: number): Record<string, unknown> {
  const base = `http://localhost:${port}`;
  return {
    schema_version: "v1",
    name_for_human: "Loop11y",
    name_for_model: "loop11y",
    description_for_human: "Evaluate, crawl, remediate, and verify accessibility issues.",
    description_for_model: "Use this tool to audit web accessibility, crawl websites, remediate issues safely, and verify improvements.",
    auth: { type: "none" },
    api: {
      type: "openapi",
      url: `${base}/openapi.json`,
      is_user_authenticated: false,
    },
    logo_url: `${base}/health`,
    contact_email: "support@example.com",
    legal_info_url: "https://opensource.org/licenses/MIT",
  };
}

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString());
}

function json(res: http.ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(value, null, 2));
}

export async function handleHttpApi(req: http.IncomingMessage, res: http.ServerResponse, port: number): Promise<boolean> {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);

  if (url.pathname === "/openapi.json") {
    json(res, 200, buildOpenApiSpec(port));
    return true;
  }

  if (url.pathname === "/.well-known/ai-plugin.json") {
    json(res, 200, buildPluginManifest(port));
    return true;
  }

  if (!url.pathname.startsWith("/api/")) {
    return false;
  }

  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return true;
  }

  try {
    const body = await readJsonBody(req);

    if (url.pathname === "/api/evaluate") {
      json(res, 200, await evaluate(evaluateSchema.parse(body)));
      return true;
    }
    if (url.pathname === "/api/repo-audit") {
      json(res, 200, await auditRepo(auditRepoSchema.parse(body)));
      return true;
    }
    if (url.pathname === "/api/crawl") {
      json(res, 200, await crawlSite(crawlSiteSchema.parse(body)));
      return true;
    }
    if (url.pathname === "/api/remediate") {
      json(res, 200, await remediate(remediateSchema.parse(body)));
      return true;
    }
    if (url.pathname === "/api/verify") {
      json(res, 200, await verifyRemediation(verifyHttpSchema.parse(body)));
      return true;
    }

    json(res, 404, { error: "Unknown API route" });
    return true;
  } catch (error) {
    json(res, 400, { error: error instanceof Error ? error.message : String(error) });
    return true;
  }
}
