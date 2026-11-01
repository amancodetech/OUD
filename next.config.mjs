/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Prisma's Node client loads this WASM compiler dynamically at runtime.
  outputFileTracingIncludes: { '/*': ['./node_modules/.prisma/client/query_compiler_bg.wasm'] },
  serverExternalPackages: ['@prisma/client', '.prisma/client', '@prisma/adapter-pg', 'pg'],
  experimental: { serverActions: { bodySizeLimit: '10mb' } },
  async headers() { return [{ source: '/:path*', headers: [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'same-origin' },
    { key: 'X-Frame-Options', value: 'DENY' },
  ] }]; },
};

export default nextConfig;
