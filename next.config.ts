import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Existe um package-lock.json na pasta do usuário (fora do projeto) e o
    // Next escolhia aquele diretório como raiz do workspace. Fixar aqui.
    root: path.resolve(import.meta.dirname),
  },
  experimental: {
    serverActions: {
      // O Extrato Mensal já lido (funcionários + rubricas) passa de 1MB em folhas grandes
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
