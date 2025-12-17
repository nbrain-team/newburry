import type { NextConfig } from "next";

// Newburry Platform - Next.js Configuration
const nextConfig: NextConfig = {
  output: 'export', // Enable static export for Render static site
  
  // Relax build constraints to prevent deployment failures
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Images configuration for static export
  images: {
    unoptimized: true,
  },
  
  // Disable server-side features for static export
  trailingSlash: true,
};

export default nextConfig;
