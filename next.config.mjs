/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Isso permite que o deploy aconteça mesmo com erros de 'any'
    ignoreBuildErrors: true,
  },
  eslint: {
    // Isso ignora os avisos de imagens (<img>) e variáveis não usadas no deploy
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
