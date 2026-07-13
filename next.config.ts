import type { NextConfig } from "next";

const isTauri = process.env.IS_TAURI_BUILD === 'true';

const nextConfig: NextConfig = {
  ...(isTauri ? { output: 'export' } : {}),
  images: {
    unoptimized: true,
  },
  async rewrites() {
    // Disable rewrites during static Tauri exports
    if (isTauri) return [];
    return [
      {
        source: '/api-proxy/ip2location',
        destination: 'https://api.ip2location.io/',
      },
      {
        source: '/api-proxy/criminalip/:path*',
        destination: 'https://api.criminalip.io/:path*',
      },
    ];
  },
  async headers() {
    if (isTauri) return [];
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
