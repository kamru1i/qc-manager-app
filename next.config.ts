import type { NextConfig } from "next";

const isTauri = process.env.IS_TAURI_BUILD === 'true';

const nextConfig: NextConfig = {
  ...(isTauri ? { output: 'export' } : {}),
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
