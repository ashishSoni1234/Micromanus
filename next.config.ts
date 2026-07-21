import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-pdf/renderer requires Node.js runtime and must not be bundled by webpack
  serverExternalPackages: ["@react-pdf/renderer", "canvas"],

  // Allow images from any HTTPS source (for potential future use)
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },

  // Suppress warnings for optional dependencies that don't exist in our build
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    return config;
  },

  // Turbopack configuration equivalent for Next.js 16
  turbopack: {},
};

export default nextConfig;
