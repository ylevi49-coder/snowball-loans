/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@anthropic-ai/sdk"],
  turbopack: {
    resolveAlias: {
      xlsx: "xlsx/dist/xlsx.full.min.js",
    },
  },
};

export default nextConfig;
