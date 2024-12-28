import type { NextConfig } from "next";
import type { Configuration as WebpackConfig } from "webpack";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (config: WebpackConfig, { isServer }) => {
    // Add a rule to handle .node files
    config.module?.rules?.push({
      test: /\.node$/,
      loader: 'node-loader',
    });

    if (!isServer) {
      // Don't attempt to load native modules on the client side
      config.resolve = {
        ...config.resolve,
        fallback: {
          ...config.resolve?.fallback,
          '@duckdb/node-api': false,
        },
      };
    }

    return config;
  },
  // Add experimental features to support native modules
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb'
    }
  },
  serverExternalPackages: ['@duckdb/node-api']
};

export default nextConfig;
