/** @type {import('next').NextConfig} */

// In production (when next build runs in the GitHub Pages workflow) we emit
// a static export under /out and serve it from a /engram subpath. In dev
// (next dev) we run at the site root so http://localhost:3010 works.
const isProd = process.env.NODE_ENV === "production";
const basePath = isProd ? "/engram" : "";

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "export",
  trailingSlash: true,
  basePath,
  assetPrefix: basePath || undefined,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  experimental: {
    optimizePackageImports: ["motion"],
  },
};

export default nextConfig;
