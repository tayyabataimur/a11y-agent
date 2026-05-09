import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "A11yAgent — Accessibility audits for any URL",
  description: "Paste a URL. Get an instant accessibility report with score, ranked issues, and remediation guidance.",
  metadataBase: new URL("https://a11y.tayyaba.dev"),
  openGraph: {
    title: "A11yAgent",
    description: "Accessibility audits for any URL.",
    url: "https://a11y.tayyaba.dev",
    siteName: "A11yAgent",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
