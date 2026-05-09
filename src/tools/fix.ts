import { z } from "zod";
import { writeFileSync } from "fs";
import { patch, type PatchResult } from "../lib/patcher.js";

export const fixComponentSchema = z.object({
  path: z
    .string()
    .describe("Absolute path to the React/TSX/JSX component file to patch."),
  violation_id: z
    .string()
    .describe(
      "The axe violation ID to fix (e.g. 'image-alt', 'button-name', 'label', 'color-contrast'). Run audit_component first to get violation IDs."
    ),
  write: z
    .boolean()
    .default(false)
    .describe(
      "If true, write the patched source back to disk immediately. If false (default), return the diff for review without modifying the file."
    ),
});

export type FixComponentInput = z.infer<typeof fixComponentSchema>;

export async function fixComponent(input: FixComponentInput): Promise<PatchResult> {
  const result = patch(input.path, input.violation_id);

  if (input.write && result.changed) {
    writeFileSync(input.path, result.patched, "utf-8");
  }

  return result;
}
