export interface Loop11yClientOptions {
  baseUrl: string;
}

async function postJson<T>(baseUrl: string, path: string, body: unknown): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Loop11y request failed: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export class Loop11yClient {
  constructor(private readonly options: Loop11yClientOptions) {}

  health(): Promise<unknown> {
    return fetch(`${this.options.baseUrl}/health`).then((r) => r.json());
  }

  evaluate<T = unknown>(input: unknown): Promise<T> {
    return postJson<T>(this.options.baseUrl, "/api/evaluate", input);
  }

  repoAudit<T = unknown>(input: unknown): Promise<T> {
    return postJson<T>(this.options.baseUrl, "/api/repo-audit", input);
  }

  crawl<T = unknown>(input: unknown): Promise<T> {
    return postJson<T>(this.options.baseUrl, "/api/crawl", input);
  }

  remediate<T = unknown>(input: unknown): Promise<T> {
    return postJson<T>(this.options.baseUrl, "/api/remediate", input);
  }

  verify<T = unknown>(input: unknown): Promise<T> {
    return postJson<T>(this.options.baseUrl, "/api/verify", input);
  }
}
