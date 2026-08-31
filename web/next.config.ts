import type { NextConfig } from "next";

import path from "path";

const nextConfig: NextConfig = {
  // Silence the workspace root warning on Vercel
  outputFileTracingRoot: path.join(process.cwd(), '../'),
  // The field build is a static export dropped onto the phone / a PHC mini-PC.
  // Nothing here may require a server at runtime.
  output: 'export',
  reactStrictMode: true,
  devIndicators: false,
};

export default nextConfig;
