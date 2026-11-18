import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8080/api/:path*",
      },
      {
        source: "/v1/:path*",
        destination: "http://127.0.0.1:8080/v1/:path*",
      },
    ];
  },
};

export default nextConfig;
