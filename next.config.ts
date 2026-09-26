import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Estos paquetes usan binarios nativos o cargan sus propios assets:
  // deben resolverse en tiempo de ejecución, no empaquetarse.
  serverExternalPackages: ["mammoth", "pdfjs-dist"],

  experimental: {
    serverActions: {
      // Las notas importadas de Word pueden traer cuerpos grandes.
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
