import type { NextConfig } from "next";
import { getSecurityHeaders } from "./lib/security-headers";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        headers: getSecurityHeaders(),
        source: "/:path*",
      },
    ];
  },
};

export default nextConfig;
