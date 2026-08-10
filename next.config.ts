import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // PGlite ships a WASM binary that must not be bundled into the server chunk.
  serverExternalPackages: ['@electric-sql/pglite'],
};

export default nextConfig;
