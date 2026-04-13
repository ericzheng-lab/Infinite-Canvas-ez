import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [];
  },
  compiler: {},
  async headers() {
    return [{
      source: '/(.*)?',
      headers: [{ key: 'X-Frame-Options', value: 'DENY' }]
    }];
  },
  experimental: {
    serverActions: { bodySizeLimit: '4mb' },
  },
  images: {
    remotePatterns: [],
  },
  serverExternalPackages: ['@aws-sdk/client-s3', '@aws-sdk/s3-request-presigner'],
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.resolve.fallback = {
        net: false, dns: false, tls: false, assert: false,
        path: false, fs: false, events: false, process: false,
      };
      // Split chunks to stay under 25MB Cloudflare Pages limit
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          minSize: 20000,
          maxSize: 5 * 1024 * 1024,
          cacheGroups: {
            default: false,
            vendors: false,
            commons: {
              name: 'commons',
              chunks: 'all',
              minChunks: 2,
            },
            lib: {
              test: /[\\/]node_modules[\\/]/,
              name(module: any) {
                const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)?.[1];
                return `npm.${packageName?.replace('@', '')}`;
              },
              priority: 10,
            },
          },
        },
      };
    }
    config.plugins.push(new webpack.NormalModuleReplacementPlugin(/node:/, (resource: any) => {
      resource.request = resource.request.replace(/^node:/, '');
    }));
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    return config;
  },
};

export default nextConfig;
