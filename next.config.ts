import { NextConfig } from 'next';

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // Add duckdb-lambda-x86 to externals for both client and server
    if (isServer) {
      config.externals = [...(config.externals as string[]), 'duckdb-lambda-x86'];
    } else {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'duckdb-lambda-x86': false,
      };
    }

    // Ensure we can load .node files
    config.module.rules.push({
      test: /\.node$/,
      use: 'node-loader',
    });

    return config;
  },
  headers: () => [
    {
      source: '/:path*',
      headers: [
        {
          key: 'Cross-Origin-Opener-Policy',
          value: 'same-origin',
        },
        {
          key: 'Cross-Origin-Embedder-Policy',
          value: 'require-corp',
        },
      ],
    },
  ],
};

export default nextConfig;