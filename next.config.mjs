/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,

  experimental: {
    serverActions: {
      // zwiększamy limit do 10 MB
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
