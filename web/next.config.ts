import type { NextConfig } from "next";

import path from "path";

const nextConfig: NextConfig = {
  // Silence the workspace root warning on Vercel
  outputFileTracingRoot: path.join(process.cwd(), '../'),
  reactStrictMode: true,
  // Deploy as a standard Next.js app on Vercel. All pages are statically
  // pre-rendered at build time; no code here requires a server at runtime.
  devIndicators: false,
};

export default nextConfig;
