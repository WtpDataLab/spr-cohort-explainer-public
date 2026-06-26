/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Fully static export — deployable to any static host (no server required).
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
