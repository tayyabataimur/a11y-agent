"use client";

import { useState, type FormEvent } from "react";

type Issue = {
  id: string;
  impact?: string;
  description?: string;
  help?: string;
  helpUrl?: string;
};

type Result = {
  score?: number;
  grade?: string;
  wcag_level?: string;
  ai_summary?: string;
  issues?: Issue[];
  quick_wins?: Issue[];
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <header>
        <h1>A11yAgent</h1>
        <p>Paste a URL. Get an instant accessibility report.</p>
      </header>

      <form onSubmit={onSubmit}>
        <input
          type="url"
          required
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-label="URL to audit"
        />
        <button type="submit" disabled={loading || !url}>
          {loading ? "Auditing…" : "Audit"}
        </button>
      </form>

      {error && <div className="error" role="alert">{error}</div>}

      {result && (
        <>
          <section className="card" aria-live="polite">
            <div className="score-row">
              <div className={`score ${result.grade ?? ""}`}>{result.score ?? "—"}</div>
              <div>
                <div className="grade">Grade {result.grade ?? "—"} · WCAG {result.wcag_level ?? "—"}</div>
                {result.ai_summary && <p className="muted" style={{ marginTop: 8 }}>{result.ai_summary}</p>}
              </div>
            </div>
          </section>

          {result.quick_wins && result.quick_wins.length > 0 && (
            <section className="card">
              <h2>Quick wins</h2>
              {result.quick_wins.map((i, idx) => (
                <IssueCard key={`qw-${idx}`} issue={i} />
              ))}
            </section>
          )}

          {result.issues && result.issues.length > 0 && (
            <section className="card">
              <h2>All issues ({result.issues.length})</h2>
              {result.issues.map((i, idx) => (
                <IssueCard key={`is-${idx}`} issue={i} />
              ))}
            </section>
          )}
        </>
      )}

      <footer>
        Powered by{" "}
        <a href="https://github.com/tayyabataimur/a11y-agent">A11yAgent</a> ·{" "}
        <a href="https://github.com/dequelabs/axe-core">axe-core</a> ·{" "}
        <a href="https://playwright.dev">Playwright</a>
      </footer>
    </main>
  );
}

function IssueCard({ issue }: { issue: Issue }) {
  return (
    <div className={`issue ${issue.impact ?? "minor"}`}>
      <h3>
        {issue.help ?? issue.id}
        {issue.impact && <span className="muted"> · {issue.impact}</span>}
      </h3>
      {issue.description && <p>{issue.description}</p>}
      {issue.helpUrl && (
        <p>
          <a href={issue.helpUrl} target="_blank" rel="noreferrer">Learn more</a>
        </p>
      )}
    </div>
  );
}
