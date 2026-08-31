import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The field build is a static export dropped onto the phone / a PHC mini-PC.
  // Nothing here may require a server at runtime.
  reactStrictMode: true,
  devIndicators: false,
};

export default nextConfig;
