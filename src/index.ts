#!/usr/bin/env node
import { runCli } from "./integrations/cli.js";
import { startHttp, startStdio } from "./mcp/server.js";

function shouldRunCli(args: string[]): boolean {
  if (args.length === 0) return false;
  const first = args[0];
  return first === "audit" || first === "audit:file" || first === "audit:repo" || first === "crawl" || first === "verify" || first === "help" || first === "--help";
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (shouldRunCli(args)) {
    await runCli(args);
    return;
  }

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
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
