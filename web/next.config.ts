import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.A11Y_API_URL ?? "https://a11y-api.fly.dev",
  },
};

export default config;
