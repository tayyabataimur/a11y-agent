import { z } from "zod";
import { evaluateUrl } from "../core/evaluate-service.js";
import { authConfigSchema, type AuthConfig } from "../core/auth.js";

export const crawlSiteSchema = z.object({
  url: z.string().optional().describe("Starting URL to crawl. Use for same-origin link discovery."),
  sitemap: z.string().optional().describe("Optional sitemap.xml URL to seed the crawl queue."),
  maxPages: z.number().int().min(1).max(200).default(20).describe("Maximum pages to audit."),
  auth: authConfigSchema.optional(),
});

export type CrawlSiteInput = z.infer<typeof crawlSiteSchema>;

export interface CrawlPageResult {
  url: string;
  score: number;
  grade: string;
  wcag_level: string;
  violations: number;
  critical: number;
  serious: number;
  top_issue_ids: string[];
}

export interface CrawlAggregateViolation {
  violation_id: string;
  pages: number;
  total_affected_elements: number;
  highest_impact: string;
}

export interface CrawlSiteResult {
  startUrl?: string;
  sitemap?: string;
  origin: string;
  pagesDiscovered: number;
  pagesAudited: number;
  pagesSkipped: number;
  averageScore: number;
  lowestScore?: { url: string; score: number };
  highestScore?: { url: string; score: number };
  topViolations: CrawlAggregateViolation[];
  pageResults: CrawlPageResult[];
  timestamp: string;
}

function ensureHttpUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Crawl only supports http/https URLs: ${value}`);
  }
  return url;
}

function normalizeUrlForCrawl(raw: string, origin: string): string | null {
  try {
    const url = new URL(raw, origin);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (url.origin !== origin) return null;
    url.hash = "";
    return url.toString().replace(/\/$/, "") || url.origin;
  } catch {
    return null;
  }
}

function extractLinksFromHtml(html: string, origin: string): string[] {
  const links = new Set<string>();
  for (const match of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    const normalized = normalizeUrlForCrawl(match[1], origin);
    if (normalized) links.add(normalized);
  }
  return [...links];
}

function extractUrlsFromSitemap(xml: string, origin: string): string[] {
  const urls = new Set<string>();
  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/gi)) {
    const normalized = normalizeUrlForCrawl(match[1].trim(), origin);
    if (normalized) urls.add(normalized);
  }
  return [...urls];
}

function buildFetchHeaders(auth?: AuthConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "user-agent": "A11yAgent/0.1 crawler",
    accept: "text/html,application/xml,text/xml;q=0.9,*/*;q=0.8",
    ...(auth?.headers ?? {}),
  };
  if (auth?.basicAuth) {
    headers.authorization = `Basic ${Buffer.from(`${auth.basicAuth.username}:${auth.basicAuth.password}`).toString("base64")}`;
  }
  return headers;
}

async function fetchText(url: string, auth?: AuthConfig): Promise<string> {
  const response = await fetch(url, {
    headers: buildFetchHeaders(auth),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function seedQueue(input: CrawlSiteInput, origin: string): Promise<string[]> {
  const urls = new Set<string>();

  if (input.sitemap) {
    const xml = await fetchText(input.sitemap, input.auth);
    for (const url of extractUrlsFromSitemap(xml, origin)) urls.add(url);
  }

  if (input.url) {
    const normalized = normalizeUrlForCrawl(input.url, origin);
    if (normalized) urls.add(normalized);
  }

  return [...urls];
}

export async function crawlSite(input: CrawlSiteInput): Promise<CrawlSiteResult> {
  if (!input.url && !input.sitemap) {
    throw new Error("Provide either url or sitemap to crawl.");
  }

  const anchor = ensureHttpUrl(input.url ?? input.sitemap!);
  const origin = anchor.origin;
  const queue = await seedQueue(input, origin);
  const visited = new Set<string>();
  const pageResults: CrawlPageResult[] = [];
  const violationMap = new Map<string, CrawlAggregateViolation>();
  let pagesSkipped = 0;

  while (queue.length > 0 && pageResults.length < input.maxPages) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    try {
      const [html, evaluation] = await Promise.all([
        fetchText(current, input.auth),
        evaluateUrl({ url: current, include_html_snippets: false, ...(input.auth ? { auth: input.auth } : {}) }),
      ]);

      const pageResult: CrawlPageResult = {
        url: current,
        score: evaluation.score,
        grade: evaluation.grade,
        wcag_level: evaluation.wcag_level,
        violations: evaluation.summary.violations,
        critical: evaluation.summary.critical,
        serious: evaluation.summary.serious,
        top_issue_ids: evaluation.top_issues.slice(0, 5).map((issue) => issue.violation_id),
      };
      pageResults.push(pageResult);

      for (const issue of evaluation.top_issues) {
        const existing = violationMap.get(issue.violation_id);
        if (existing) {
          existing.pages += 1;
          existing.total_affected_elements += issue.affected_elements;
        } else {
          violationMap.set(issue.violation_id, {
            violation_id: issue.violation_id,
            pages: 1,
            total_affected_elements: issue.affected_elements,
            highest_impact: issue.impact,
          });
        }
      }

      for (const discovered of extractLinksFromHtml(html, origin)) {
        if (!visited.has(discovered) && !queue.includes(discovered) && queue.length + pageResults.length < input.maxPages * 3) {
          queue.push(discovered);
        }
      }
    } catch {
      pagesSkipped += 1;
    }
  }

  pageResults.sort((a, b) => a.score - b.score);
  const averageScore = pageResults.length > 0
    ? Math.round(pageResults.reduce((sum, page) => sum + page.score, 0) / pageResults.length)
    : 0;

  const topViolations = [...violationMap.values()]
    .sort((a, b) => {
      if (b.pages !== a.pages) return b.pages - a.pages;
      return b.total_affected_elements - a.total_affected_elements;
    })
    .slice(0, 15);

  const lowest = pageResults[0];
  const highest = [...pageResults].sort((a, b) => b.score - a.score)[0];

  return {
    ...(input.url ? { startUrl: input.url } : {}),
    ...(input.sitemap ? { sitemap: input.sitemap } : {}),
    origin,
    pagesDiscovered: visited.size + queue.length,
    pagesAudited: pageResults.length,
    pagesSkipped,
    averageScore,
    ...(lowest ? { lowestScore: { url: lowest.url, score: lowest.score } } : {}),
    ...(highest ? { highestScore: { url: highest.url, score: highest.score } } : {}),
    topViolations,
    pageResults,
    timestamp: new Date().toISOString(),
  };
}
