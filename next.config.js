/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    domains: ['lh3.googleusercontent.com', 'avatars.githubusercontent.com', 'cdn.pixabay.com'],
  },
};

module.exports = nextConfig;
