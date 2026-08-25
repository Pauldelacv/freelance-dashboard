import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "motdepasse-e2e";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
}

test.describe("connexion", () => {
  test("refuse un mauvais mot de passe", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Mot de passe").fill("mauvais-mot-de-passe");
    await page.getByRole("button", { name: "Se connecter" }).click();
    // Next ajoute son propre role="alert" (annonceur de route) : on vise le message.
    await expect(page.getByText("Mot de passe incorrect.")).toBeVisible();
  });

  test("protège les pages sans session", async ({ page }) => {
    await page.goto("/calendrier");
    await expect(page).toHaveURL(/\/login/);
  });

  test("accepte le bon mot de passe", async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL("/");
  });
});

test.describe("cœur du produit", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("crée un client puis coche des jours dans le calendrier", async ({ page }) => {
    await page.goto("/clients");
    await page.getByRole("button", { name: "Nouveau client" }).first().click();
    await page.getByLabel("Nom").fill("Client E2E");
    await page.getByLabel("TJM (€)").fill("600");
    await page.getByRole("button", { name: "Créer le client" }).click();

    await expect(page.getByRole("link", { name: /Client E2E/ })).toBeVisible();

    // Une journée cochée pour ce client.
    await page.goto("/calendrier?m=2026-09");
    const jour = page.locator('[data-date="2026-09-07"]');
    await jour.click();
    await expect(jour).toContainText("Client E2E");
    await expect(page.getByTestId("total-revenue")).toHaveText("600,00 €");
    await expect(page.getByTestId("total-days")).toHaveText("1");

    // Persistée côté serveur.
    await page.reload();
    await expect(page.getByTestId("total-revenue")).toHaveText("600,00 €");

    // Maj+clic : demi-journée.
    await page.locator('[data-date="2026-09-07"]').click({ modifiers: ["Shift"] });
    await expect(page.getByTestId("total-revenue")).toHaveText("300,00 €");
    await expect(page.getByTestId("total-days")).toHaveText("0,5");

    // Re-clic identique : la journée est retirée.
    await page.locator('[data-date="2026-09-07"]').click({ modifiers: ["Shift"] });
    await expect(page.getByTestId("total-revenue")).toHaveText("0,00 €");
  });

  test("coche une plage de jours au clic-glissé", async ({ page }) => {
    await page.goto("/calendrier?m=2026-10");
    const debut = page.locator('[data-date="2026-10-05"]');
    const fin = page.locator('[data-date="2026-10-08"]');

    await debut.hover();
    await page.mouse.down();
    await fin.hover();
    await page.mouse.up();

    // 4 jours à 600 € : lundi au jeudi.
    await expect(page.getByTestId("total-days")).toHaveText("4");
    await expect(page.getByTestId("total-revenue")).toHaveText("2 400,00 €");
  });

  test("le tableau de bord agrège les jours cochés", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("À facturer").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "CA des 12 derniers mois" })).toBeVisible();
  });
});
