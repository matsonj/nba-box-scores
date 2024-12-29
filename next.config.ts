import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@duckdb/node-api"],
  webpack: (config, { isServer }) => {
    // Exclude native modules from webpack build
    if (isServer) {
      config.externals = [...(config.externals as string[]), 'duckdb-lambda-x86'];
    }
    return config;
  },
};

export default nextConfig;