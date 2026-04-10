/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/projects/apms";

const nextConfig = {
  basePath,
  output: "standalone"
};

export default nextConfig;
