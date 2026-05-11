import { z } from "zod";

export const authConfigSchema = z.object({
  storageState: z
    .string()
    .optional()
    .describe("Optional path to a Playwright storage state JSON file for authenticated sessions."),
  headers: z
    .record(z.string())
    .optional()
    .describe("Optional HTTP headers to send with page requests, e.g. staging flags or bearer tokens."),
  basicAuth: z
    .object({
      username: z.string(),
      password: z.string(),
    })
    .optional()
    .describe("Optional HTTP basic auth credentials."),
});

export type AuthConfig = z.infer<typeof authConfigSchema>;
