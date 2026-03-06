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

const withSerwist = require('@serwist/next').default({
  swSrc: 'service-worker/index.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
});

module.exports = withSerwist(nextConfig);
