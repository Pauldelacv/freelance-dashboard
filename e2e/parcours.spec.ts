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

  test("clôture un mois et le suit jusqu'à l'encaissement", async ({ page }) => {
    await page.goto("/clients");
    await page.getByRole("button", { name: "Nouveau client" }).first().click();
    await page.getByLabel("Nom").fill("Client Clôture");
    await page.getByLabel("TJM (€)").fill("500");
    await page.getByRole("button", { name: "Créer le client" }).click();
    await expect(page.getByRole("link", { name: /Client Clôture/ })).toBeVisible();

    await page.goto("/calendrier?m=2026-11");
    await page.selectOption('select[aria-label="Client actif"]', { label: "Client Clôture" });
    await page.locator('[data-date="2026-11-02"]').click();
    await page.locator('[data-date="2026-11-03"]').click();

    await page.goto("/clients");
    await page.getByRole("link", { name: /Client Clôture/ }).click();
    await expect(page.getByText("À facturer 1 000,00 €")).toBeVisible();

    await page.getByRole("button", { name: "Marquer facturé" }).click();
    await expect(page.getByText("Facturé 1 000,00 €")).toBeVisible();

    await page.getByRole("button", { name: "Marquer encaissé" }).click();
    await expect(page.getByText("Encaissé 1 000,00 €")).toBeVisible();
  });

  test("enchaîne deux créations sans rouvrir la page", async ({ page }) => {
    // Régression : la boîte de dialogue restait ouverte à la deuxième création,
    // l'état de la Server Action portant déjà ok: true.
    await page.goto("/prospects");
    for (const nom of ["Prospect A", "Prospect B"]) {
      await page.getByRole("button", { name: "Nouveau prospect" }).first().click();
      const formulaire = page.getByRole("dialog");
      await formulaire.getByLabel("Intitulé").fill(nom);
      await formulaire.getByRole("button", { name: "Créer" }).click();
      await expect(page.getByRole("dialog")).toBeHidden();
      await expect(page.getByText(nom)).toBeVisible();
    }
  });

  test("enregistre les réglages", async ({ page }) => {
    await page.goto("/reglages");
    await page.getByLabel("URL de votre espace Indy").fill("https://app.indy.fr");
    await page.getByLabel("CA mensuel visé (€)").fill("9000");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Réglages enregistrés")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("URL de votre espace Indy")).toHaveValue("https://app.indy.fr");
    // Le lien Indy apparaît dans la navigation une fois l'URL renseignée.
    await expect(page.getByRole("link", { name: "Facturation Indy" })).toBeVisible();
  });

  test("ajoute un site de veille et le filtre", async ({ page }) => {
    await page.goto("/veille");
    await page.getByRole("button", { name: "Ajouter un site" }).first().click();
    // Le filtre de la page et le formulaire partagent des libellés : on reste
    // dans la boîte de dialogue.
    const formulaire = page.getByRole("dialog");
    await formulaire.getByLabel("URL").fill("https://exemple-veille.fr");
    await formulaire.getByLabel("Titre").fill("Exemple Veille");
    await formulaire.getByLabel("Catégorie").fill("Technique");
    await formulaire.getByLabel("Tags").fill("Next, SEO");
    await formulaire.getByRole("button", { name: "Ajouter", exact: true }).click();

    await expect(page.getByRole("link", { name: /Exemple Veille/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "#next" })).toBeVisible();

    // Le filtre par tag masque ce qui ne correspond pas.
    await page.getByRole("button", { name: "#seo" }).click();
    await expect(page.getByRole("link", { name: /Exemple Veille/ })).toBeVisible();

    // La recherche textuelle aussi.
    await page.getByRole("button", { name: "#seo" }).click();
    await page.getByLabel("Rechercher").fill("introuvable-xyz");
    await expect(page.getByText("Aucun site ne correspond à ces filtres.")).toBeVisible();
  });

  test("importe une liste de sites en JSON", async ({ page }) => {
    await page.goto("/veille");
    await page.getByRole("button", { name: "Importer" }).first().click();
    await page
      .locator("textarea[name=payload]")
      .fill('[{"title":"Site importé","url":"https://importe.fr","category":"Import"}]');
    await page.getByRole("button", { name: "Importer", exact: true }).last().click();
    await expect(page.getByRole("link", { name: /Site importé/ })).toBeVisible();
  });

  test("le tableau de bord agrège les jours cochés", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("À facturer").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "CA des 12 derniers mois" })).toBeVisible();
  });
});
