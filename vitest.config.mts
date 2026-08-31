import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

export default defineConfig({
  test: {
    environment: "node",
    // Les calculs métier vivent dans lib/, mais le script de migration est
    // lui aussi couvert : c'est lui qui décide de ce qui survit à un
    // redéploiement.
    include: ["lib/**/*.test.ts", "scripts/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
