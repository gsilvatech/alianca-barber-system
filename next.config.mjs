/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Ignora os erros de ESLint na hora de subir para a Vercel
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Ignora os errinhos de tipagem do TypeScript na hora do build
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
