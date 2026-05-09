import { NextResponse } from "next/server";

const API_URL = process.env.A11Y_API_URL ?? "https://a11y-api.fly.dev";

export const runtime = "edge";

export async function POST(req: Request) {
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.url || typeof body.url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  try {
    const parsed = new URL(body.url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json({ error: "Only http(s) URLs allowed" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const upstream = await fetch(`${API_URL}/api/evaluate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: body.url }),
  });

  const data = await upstream.json().catch(() => ({ error: "Upstream returned non-JSON" }));
  return NextResponse.json(data, { status: upstream.status });
}
