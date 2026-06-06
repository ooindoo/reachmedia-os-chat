/** @type {import('next').NextConfig} */
const nextConfig = {
  // Increase serverless function timeout for AI calls
  experimental: {
    serverComponentsExternalPackages: ["@notionhq/client"],
  },
};

export default nextConfig;
