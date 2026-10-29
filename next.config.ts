import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  allowedDevOrigins: ["127.0.0.1", "192.168.3.6", "172.16.80.154"],
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
