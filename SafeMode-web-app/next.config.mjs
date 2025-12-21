/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better development warnings
  reactStrictMode: true,

  env: {
    NEXT_PUBLIC_BOT_PHONE_NUMBER: process.env.NEXT_PUBLIC_BOT_PHONE_NUMBER,
    NEXT_PUBLIC_WA_ME_LINK: process.env.NEXT_PUBLIC_WA_ME_LINK,
  },

  // Image optimization configuration
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 days
  },

  // Compiler optimizations
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === "production",
  },

  // Experimental features for better performance
  experimental: {
    // Enable optimized package imports for tree-shaking
    optimizePackageImports: ["lucide-react"],
  },

  // Turbopack configuration (Next.js 16+ default bundler)
  turbopack: {
    // Empty config to use default Turbopack settings
  },

  // Production source maps (disable for smaller builds)
  productionBrowserSourceMaps: false,

  // Compress responses
  compress: true,

  // Power by header removal for security
  poweredByHeader: false,

  // Headers for caching and security
  async headers() {
    return [
      {
        source: "/:all*(svg|jpg|png|webp|avif)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/fonts/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
