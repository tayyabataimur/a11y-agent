import { z } from "zod";
import { runAxeAudit, type AuditResult } from "../lib/axe-runner.js";

export const auditComponentSchema = z.object({
  path: z
    .string()
    .describe(
      "Absolute file path to an HTML file, or a full URL (http/https). For React components, build or serve the component first."
    ),
});

export type AuditComponentInput = z.infer<typeof auditComponentSchema>;

export async function auditComponent(input: AuditComponentInput): Promise<AuditResult> {
  return runAxeAudit(input.path);
}
