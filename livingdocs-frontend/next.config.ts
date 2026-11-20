import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL || "https://livingdocs-backend.onrender.com";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: "/v1/:path*",
        destination: `${backendUrl}/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
