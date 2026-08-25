import { defineConfig, devices } from "@playwright/test";

/**
 * Parcours critiques uniquement (connexion, client, calendrier).
 * Le serveur tourne sur une base SQLite dédiée, recréée à chaque exécution.
 */
const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    // Permet d'utiliser un Chromium déjà présent sur la machine (CI, conteneur)
    // au lieu de le retélécharger : PLAYWRIGHT_CHROMIUM_PATH=/chemin/vers/chrome
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Voir scripts/e2e-server.mjs : build standalone lancé dans un dossier isolé,
    // avec sa propre base SQLite et ses propres variables d'environnement.
    command: "node scripts/e2e-server.mjs",
    port: PORT,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { E2E_PORT: String(PORT) },
  },
});
