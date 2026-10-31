/** @type {import('next').NextConfig} */
const nextConfig = { experimental: { serverComponentsExternalPackages: ['mysql2', 'mongodb'] } };
export default nextConfig;
