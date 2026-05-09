#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import http from "node:http";
import { randomUUID } from "node:crypto";

import { auditComponent, auditComponentSchema } from "./tools/audit.js";
import { fixComponent, fixComponentSchema } from "./tools/fix.js";
import { auditRepo, auditRepoSchema } from "./tools/scan.js";
import { remediate, remediateSchema } from "./tools/remediate.js";
import { evaluate, evaluateSchema } from "./tools/evaluate.js";

const TOOLS: Tool[] = [
  {
    name: "audit_component",
    description:
      "Audit a web component or page for accessibility violations using axe-core. Accepts an absolute file path to an HTML file or a live URL. Returns a structured list of violations with WCAG criteria, severity, and the affected HTML nodes. Run this first to get violation IDs before calling fix_component.",
    inputSchema: zodToJsonSchema(auditComponentSchema) as Tool["inputSchema"],
  },
  {
    name: "fix_component",
    description:
      "Auto-patch an accessibility violation in a React/TSX/JSX component. Takes the file path and a violation ID from audit_component. Returns the original source, the patched source, and an explanation of what changed and why. Supports: image-alt, button-name, label, aria-label, color-contrast, link-name, heading-order.",
    inputSchema: zodToJsonSchema(fixComponentSchema) as Tool["inputSchema"],
  },
  {
    name: "audit_repo",
    description:
      "Scan an entire project directory for accessibility violations. Walks all .tsx, .jsx, and .html files (up to maxFiles), audits each one, and returns a prioritised summary sorted by severity. Identifies the most common violations across the codebase so you know where to focus remediation effort.",
    inputSchema: zodToJsonSchema(auditRepoSchema) as Tool["inputSchema"],
  },
  {
    name: "evaluate",
    description:
      "Evaluate a live site's accessibility and produce a scored report designed for AI tools. Returns a 0-100 score, letter grade, WCAG compliance level (Non-compliant / Partial A / A / AA / AAA), ranked issue list with plain-English suggestions and before/after code examples, quick-win violations that can be auto-patched, and an ai_summary field — a narrative paragraph that any AI (Claude, ChatGPT, Gemini, etc.) can read and relay to users as actionable advice. Use this as the starting point: evaluate first, then call remediate to apply fixes.",
    inputSchema: zodToJsonSchema(evaluateSchema) as Tool["inputSchema"],
  },
  {
    name: "remediate",
    description:
      "End-to-end accessibility remediation in a single call. Audits a rendered URL with axe-core, then patches the corresponding source file. Three modes controlled by the 'mode' parameter: 'report' (audit only — no changes, full violation list), 'diff' (audit + patch, returns before/after diff without writing to disk — use for review), 'fix' (audit + patch + write — applies all auto-fixable violations to disk). Filter by severity with min_severity, or target specific violation IDs with the 'only' array. Returns a structured breakdown of what was fixed, what needs manual attention, and what was skipped.",
    inputSchema: zodToJsonSchema(remediateSchema) as Tool["inputSchema"],
  },
];

function createServer(): Server {
  const server = new Server(
    { name: "a11y-agent", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "audit_component": {
          const input = auditComponentSchema.parse(args);
          const result = await auditComponent(input);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }

        case "fix_component": {
          const input = fixComponentSchema.parse(args);
          const result = await fixComponent(input);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }

        case "audit_repo": {
          const input = auditRepoSchema.parse(args);
          const result = await auditRepo(input);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }

        case "evaluate": {
          const input = evaluateSchema.parse(args);
          const result = await evaluate(input);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }

        case "remediate": {
          const input = remediateSchema.parse(args);
          const result = await remediate(input);
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }

        default:
          return {
            content: [{ type: "text", text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  return server;
}

async function startStdio(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("a11y-agent MCP server running on stdio\n");
}

async function startHttp(port: number): Promise<void> {
  // Map of session ID -> transport for stateful connections
  const sessions = new Map<string, StreamableHTTPServerTransport>();

  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);

    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", version: "0.1.0" }));
      return;
    }

    if (url.pathname !== "/mcp") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    // Parse JSON body for POST requests
    let body: unknown;
    if (req.method === "POST") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      try {
        body = JSON.parse(Buffer.concat(chunks).toString());
      } catch {
        res.writeHead(400);
        res.end("Invalid JSON");
        return;
      }
    }

    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (req.method === "POST") {
      // New session or existing session
      if (sessionId && sessions.has(sessionId)) {
        const transport = sessions.get(sessionId)!;
        await transport.handleRequest(req, res, body);
      } else {
        // New session — create fresh server + transport
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
        });
        const server = createServer();
        await server.connect(transport);

        transport.onclose = () => {
          if (transport.sessionId) sessions.delete(transport.sessionId);
        };

        await transport.handleRequest(req, res, body);

        if (transport.sessionId) {
          sessions.set(transport.sessionId, transport);
        }
      }
    } else if (req.method === "GET" || req.method === "DELETE") {
      if (!sessionId || !sessions.has(sessionId)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid or missing session ID" }));
        return;
      }
      const transport = sessions.get(sessionId)!;
      await transport.handleRequest(req, res);
    } else {
      res.writeHead(405);
      res.end("Method not allowed");
    }
  });

  httpServer.listen(port, () => {
    process.stderr.write(
      `a11y-agent MCP server running on http://localhost:${port}/mcp\n`
    );
  });
}

async function main(): Promise<void> {
  const port = process.env["A11Y_AGENT_PORT"]
    ? parseInt(process.env["A11Y_AGENT_PORT"], 10)
    : null;

  if (port !== null) {
    await startHttp(port);
  } else {
    await startStdio();
  }
}

main().catch((err) => {
  process.stderr.write(
    `Fatal: ${err instanceof Error ? err.message : String(err)}\n`
  );
  process.exit(1);
});
