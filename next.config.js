/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow longer serverless function execution for webhook processing
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

module.exports = nextConfig;
