#!/usr/bin/env node
// Live end-to-end smoke test. Runs the published CLI against a real URL,
// then asserts the report shape. No mocks. No fixtures. If the network or
// target site is down the test should be skipped (set LIVE_AUDIT_REQUIRED=1
// in CI to convert skip into failure).

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TARGET = process.env.LIVE_AUDIT_URL ?? "https://tayyaba.dev";
const REQUIRED = process.env.LIVE_AUDIT_REQUIRED === "1";
const CLI = process.env.LOOP11Y_BIN ?? new URL("../dist/index.js", import.meta.url).pathname;

function fail(reason) {
  if (REQUIRED) {
    console.error(`✗ live audit failed: ${reason}`);
    process.exit(1);
  }
  console.warn(`↷ live audit skipped: ${reason}`);
  process.exit(0);
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`✗ assertion failed: ${msg}`);
    process.exit(1);
  }
}

const workdir = mkdtempSync(join(tmpdir(), "loop11y-live-"));
const reportPath = join(workdir, "report.json");

console.log(`→ auditing ${TARGET} via ${CLI}`);
const run = spawnSync(process.execPath, [CLI, "audit", TARGET, "--json", "--output", reportPath], {
  encoding: "utf8",
  timeout: 120_000,
});

if (run.status !== 0) {
  const stderr = (run.stderr ?? "").slice(0, 2000);
  rmSync(workdir, { recursive: true, force: true });
  fail(`CLI exited ${run.status}: ${stderr.trim() || "(no stderr)"}`);
}

let report;
try {
  report = JSON.parse(readFileSync(reportPath, "utf8"));
} catch (err) {
  rmSync(workdir, { recursive: true, force: true });
  fail(`report not valid JSON: ${err.message}`);
}

rmSync(workdir, { recursive: true, force: true });

assert(typeof report.score === "number", "report.score is number");
assert(report.score >= 0 && report.score <= 100, "report.score in [0,100]");
assert(typeof report.grade === "string" && /^[A-F]$/.test(report.grade), "report.grade is A-F");
assert(typeof report.wcag_level === "string", "report.wcag_level is string");
assert(typeof report.ai_summary === "string" && report.ai_summary.length > 0, "report.ai_summary present");
assert(Array.isArray(report.top_issues), "report.top_issues is array");
assert(typeof report.summary === "object" && report.summary !== null, "report.summary is object");

console.log(`✓ live audit OK — ${TARGET} score=${report.score} grade=${report.grade}`);
