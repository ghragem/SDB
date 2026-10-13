import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Importação de conversas envia lotes de texto; o padrão (1 MB) é pequeno para isso.
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
