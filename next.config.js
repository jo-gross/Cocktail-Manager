/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    dangerouslyAllowSVG: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  env: {
    DEPLOYMENT: process.env.DEPLOYMENT,
    DEMO_MODE: process.env.DEMO_MODE,
    NEXT_PUBLIC_DEMO_MODE: process.env.DEMO_MODE,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Ensure Node.js modules are not bundled for server-side code
      config.externals = config.externals || [];
      config.externals.push({
        'node:crypto': 'commonjs crypto',
        crypto: 'commonjs crypto',
        fs: 'commonjs fs',
        path: 'commonjs path',
      });
    }
    return config;
  },
};

const withPWA = require('next-pwa')({
  dest: 'public',
  runtimeCaching: [
    {
      urlPattern: /\/queue$/,
      handler: 'NetworkOnly', // don't cache queue requests, always fetch from network
    },
    {
      urlPattern: /\/ratings$/,
      handler: 'NetworkOnly', // don't cache queue requests, always fetch from network
    },
    {
      urlPattern: /^https?.*/,
      handler: 'StaleWhileRevalidate', // always cache first, but go to network (if available) for new data and update cache
      method: 'GET', // only cache GET requests
      options: {
        cacheName: 'http-cache',
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 14 * 24 * 60 * 60, // 14 days
        },
      },
    },
  ],
});

module.exports = withPWA(nextConfig);
