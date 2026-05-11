import { z } from "zod";
import { evaluateUrl } from "../core/evaluate-service.js";
import { authConfigSchema } from "../core/auth.js";
import type { EvaluateResult } from "../core/types.js";

export const evaluateSchema = z.object({
  url: z
    .string()
    .describe(
      "URL of the live site or page to evaluate (e.g. https://example.com, http://localhost:3000/about). Must be reachable from this machine."
    ),
  include_passing: z
    .boolean()
    .default(false)
    .describe("Include a list of passing checks in the report (default: false)."),
  include_html_snippets: z
    .boolean()
    .default(true)
    .describe(
      "Include the failing HTML snippets from the live page in each issue's suggestion. Helps AI tools generate precise fixes. Default: true."
    ),
  auth: authConfigSchema.optional(),
});

export type EvaluateInput = z.infer<typeof evaluateSchema>;
export type { EvaluateResult };

export async function evaluate(input: EvaluateInput): Promise<EvaluateResult> {
  return evaluateUrl(input);
}
