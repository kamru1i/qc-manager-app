import type { NextConfig } from "next";

const isStaticBuild = process.env.IS_TAURI_BUILD === 'true' || process.env.IS_CAPACITOR_BUILD === 'true';

const nextConfig: NextConfig = {
  ...(isStaticBuild ? { output: 'export' } : {}),
  images: {
    unoptimized: true,
  },
  async headers() {
    if (isStaticBuild) return [];
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
