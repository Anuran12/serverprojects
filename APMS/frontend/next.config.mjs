/** @type {import('next').NextConfig} */
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").trim();

const nextConfig = {
  output: "standalone"
};

if (basePath) {
  nextConfig.basePath = basePath;
}

export default nextConfig;
