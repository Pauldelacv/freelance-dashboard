import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build autonome : l'image Docker n'embarque que le strict nécessaire.
  output: "standalone",
  poweredByHeader: false,
  // Modules natifs : ils doivent rester hors du bundle pour que le binaire .node
  // soit résolu depuis node_modules à l'exécution.
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3", "@node-rs/argon2"],
  experimental: {
    // Les Server Actions sont appelées depuis le domaine configuré dans Coolify.
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
