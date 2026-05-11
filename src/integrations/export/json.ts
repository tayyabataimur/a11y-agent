import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { toMarkdownReport } from "./markdown.js";

export type ReportFormat = "json" | "markdown";

export function toJsonReport(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function writeJsonReport(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, toJsonReport(value), "utf-8");
}

export function writeReport(path: string, value: unknown, format: ReportFormat): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, format === "markdown" ? toMarkdownReport(value) : toJsonReport(value), "utf-8");
}
