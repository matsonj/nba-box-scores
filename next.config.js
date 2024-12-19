/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Add a rule to handle .node files
    config.module.rules.push({
      test: /\.node$/,
      use: 'node-loader',
    });

    if (!isServer) {
      // Don't attempt to load native modules on the client side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        '@duckdb/node-api': false,
      };
    }

    return config;
  },
};

module.exports = nextConfig;
