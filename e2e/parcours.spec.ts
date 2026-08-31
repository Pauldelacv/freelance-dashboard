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

  test("pose un cookie de session utilisable en http", async ({ page }) => {
    // Régression : le cookie était marqué Secure dès que NODE_ENV valait
    // "production". Servie en http:// (déploiement sur adresse IP, domaine pas
    // encore posé), l'application redemandait alors le mot de passe à chaque
    // page — le navigateur jetant le cookie sans rien dire.
    await login(page);
    const cookie = (await page.context().cookies()).find((c) => c.name === "fd_session");
    expect(cookie).toBeDefined();
    expect(cookie?.secure).toBe(false);
    expect(cookie?.httpOnly).toBe(true);

    // Et la session tient d'une page à l'autre.
    await page.goto("/clients");
    await expect(page).toHaveURL("/clients");
    await page.goto("/calendrier");
    await expect(page).toHaveURL(/\/calendrier/);
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

  test("coche les jours ouvrés de plusieurs semaines sans les week-ends", async ({ page }) => {
    // Février 2027 commence un lundi. Du lundi 1er au vendredi 12, le
    // glissement traverse deux lignes : la sélection est le rectangle des cinq
    // premières colonnes, pas la suite des jours — les 6, 7, 13 et 14 restent
    // vierges.
    await page.goto("/calendrier?m=2027-02");
    await page.locator('[data-date="2027-02-01"]').hover();
    await page.mouse.down();
    await page.locator('[data-date="2027-02-12"]').hover();
    await page.mouse.up();

    await expect(page.getByTestId("total-days")).toHaveText("10");
    await expect(page.getByTestId("total-revenue")).toHaveText("6 000,00 €");
    await expect(page.locator('[data-date="2027-02-06"]')).not.toContainText("Client E2E");
    await expect(page.locator('[data-date="2027-02-07"]')).not.toContainText("Client E2E");

    // Et le serveur en a gardé exactement autant.
    await page.reload();
    await expect(page.getByTestId("total-days")).toHaveText("10");
  });

  test("bascule sur la vue annuelle en lecture seule", async ({ page }) => {
    await page.goto("/calendrier?m=2026-10");
    await page.getByRole("link", { name: "Année" }).click();

    await expect(page).toHaveURL(/vue=annee&a=2026/);
    // Les jours d'octobre remontent dans les totaux de l'année.
    await expect(page.getByTestId("year-billable-days")).toHaveText("4");
    await expect(page.getByTestId("year-revenue")).toHaveText("2 400,00 €");

    // Un mois de la grille renvoie vers la vue mensuelle, où l'on saisit.
    await page.getByRole("link", { name: "octobre" }).click();
    await expect(page).toHaveURL(/m=2026-10/);
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

  test("pointe un encaissement depuis le tableau de bord", async ({ page }) => {
    // Indy ne dit jamais qu'une facture est payée : sans ce geste, « encaissé »
    // reste à zéro. Le pointage doit donc marcher depuis l'écran d'accueil,
    // pas seulement depuis la fiche client.
    await page.goto("/clients");
    await page.getByRole("button", { name: "Nouveau client" }).first().click();
    await page.getByLabel("Nom").fill("Client Pointage");
    await page.getByLabel("TJM (€)").fill("700");
    await page.getByRole("button", { name: "Créer le client" }).click();
    await expect(page.getByRole("link", { name: /Client Pointage/ })).toBeVisible();

    await page.goto("/calendrier?m=2026-12");
    await page.selectOption('select[aria-label="Client actif"]', { label: "Client Pointage" });
    await page.locator('[data-date="2026-12-01"]').click();

    await page.goto("/clients");
    await page.getByRole("link", { name: /Client Pointage/ }).click();
    await page.getByRole("button", { name: "Marquer facturé" }).click();
    await expect(page.getByText("Facturé 700,00 €")).toBeVisible();

    await page.goto("/");
    const row = page.getByRole("listitem").filter({ hasText: "Client Pointage" });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Encaissé", exact: true }).click();

    // La ligne quitte la liste, et de quoi défaire le clic reste à l'écran.
    await expect(row).toHaveCount(0);
    await expect(page.getByText(/encaissé pour Client Pointage/)).toBeVisible();

    await page.getByRole("button", { name: "Annuler" }).click();
    await expect(row).toBeVisible();
  });

  test("supprime un client sans jour saisi", async ({ page }) => {
    await page.goto("/clients");
    await page.getByRole("button", { name: "Nouveau client" }).first().click();
    await page.getByLabel("Nom").fill("Client Jetable");
    await page.getByLabel("TJM (€)").fill("400");
    await page.getByRole("button", { name: "Créer le client" }).click();
    await expect(page.getByRole("link", { name: /Client Jetable/ })).toBeVisible();

    await page.getByRole("button", { name: "Supprimer Client Jetable" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Supprimer définitivement" })
      .click();

    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByRole("link", { name: /Client Jetable/ })).toHaveCount(0);
  });

  test("propose l'archivage plutôt que la suppression d'un client qui porte des jours", async ({
    page,
  }) => {
    await page.goto("/clients");
    await page.getByRole("button", { name: "Supprimer Client Clôture" }).click();

    const boite = page.getByRole("dialog");
    await expect(boite.getByText(/jours? saisis?/)).toBeVisible();
    await expect(boite.getByRole("button", { name: "Supprimer définitivement" })).toBeDisabled();
    await expect(boite.getByRole("button", { name: "Archiver" })).toBeVisible();
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

  test("renvoie vers la connexion quand la session tombe pendant une saisie", async ({ page }) => {
    // Régression : le middleware redirigeait aussi les appels de Server Action.
    // Le client Next recevait du HTML au lieu de sa réponse et l'application
    // plantait sur « An unexpected response was received from the server. »
    const erreurs: string[] = [];
    page.on("pageerror", (error) => erreurs.push(error.message));

    await page.goto("/clients");
    await page.getByRole("button", { name: "Nouveau client" }).first().click();
    await page.getByLabel("Nom").fill("Client sans session");
    await page.getByLabel("TJM (€)").fill("500");
    await page.context().clearCookies();
    await page.getByRole("button", { name: "Créer le client" }).click();

    await expect(page).toHaveURL(/\/login/);
    expect(erreurs).toEqual([]);
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

  test("donne au mois affiché son propre objectif", async ({ page }) => {
    await page.goto("/");
    // Selon qu'un objectif par défaut existe déjà, le point d'entrée s'appelle
    // « Modifier » ou « en définir un » : c'est la même boîte.
    await page.getByRole("button", { name: /^(Modifier|en définir un)$/ }).click();

    const boite = page.getByRole("dialog");
    await boite.locator("#month-revenue").fill("12345");
    await boite.getByRole("button", { name: "Enregistrer le mois" }).click();

    await expect(page.getByRole("dialog")).toBeHidden();
    // La jauge suit l'objectif du mois, pas la valeur par défaut des réglages.
    await expect(page.getByText("Objectif 12 345 €")).toBeVisible();

    await page.reload();
    await expect(page.getByText("Objectif 12 345 €")).toBeVisible();
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

  test("exporte les données", async ({ page }) => {
    await page.goto("/reglages");

    const [jsonDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "Télécharger le JSON" }).click(),
    ]);
    expect(jsonDownload.suggestedFilename()).toMatch(/^sauvegarde-\d{4}-\d{2}-\d{2}\.json$/);

    const [csvDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "Jours travaillés" }).click(),
    ]);
    expect(csvDownload.suggestedFilename()).toMatch(/^jours-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  test("refuse l'export sans session", async ({ page }) => {
    await page.context().clearCookies();
    const response = await page.request.get("/api/backup");
    // Le middleware renvoie vers la page de connexion.
    expect(response.url()).toContain("/login");
  });

  test("expose un manifeste installable", async ({ page }) => {
    const response = await page.request.get("/manifest.webmanifest");
    expect(response.ok()).toBe(true);
    const manifest = await response.json();
    expect(manifest.name).toBe("Freelance Dashboard");
    expect(manifest.display).toBe("standalone");
    const icon = await page.request.get(manifest.icons[0].src);
    expect(icon.ok()).toBe(true);
  });

  test("le tableau de bord agrège les jours cochés", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("À facturer").first()).toBeVisible();
    // L'historique 12 mois est un `figure` nommé par sa légende : on vise le
    // nom accessible plutôt qu'un titre de carte, qui n'est que de la mise en
    // page et bouge à chaque retouche visuelle.
    await expect(page.getByRole("figure", { name: /douze derniers mois/i })).toBeVisible();
  });

  test("la palette ⌘K cherche un client et y navigue", async ({ page }) => {
    await page.goto("/");

    await page.keyboard.press("ControlOrMeta+k");
    const palette = page.getByRole("dialog", { name: "Recherche et commandes" });
    await expect(palette).toBeVisible();

    // Saisie en minuscules : la recherche doit être tolérante à la casse.
    await palette.getByLabel("Rechercher").fill("client e2e");
    const resultat = palette.getByRole("option", { name: /Client E2E/ });
    await expect(resultat).toBeVisible();

    await page.keyboard.press("Enter");
    await expect(palette).toBeHidden();
    await expect(page.getByRole("heading", { name: "Client E2E" })).toBeVisible();
  });

  test("la palette se ferme avec Échap", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("ControlOrMeta+k");
    const palette = page.getByRole("dialog", { name: "Recherche et commandes" });
    await expect(palette).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(palette).toBeHidden();
  });
});

test.describe("mot de passe", () => {
  const NOUVEAU = "nouveau-motdepasse-e2e";

  async function changer(page: Page, actuel: string, nouveau: string) {
    await page.goto("/reglages");
    await page.getByLabel("Mot de passe actuel").fill(actuel);
    await page.getByLabel("Nouveau mot de passe").fill(nouveau);
    await page.getByLabel("Confirmation").fill(nouveau);
    await page.getByRole("button", { name: "Changer le mot de passe" }).click();
  }

  test("se change depuis les réglages", async ({ page }) => {
    await login(page);

    // Une saisie incohérente n'écrit rien.
    await changer(page, "pas-le-bon", NOUVEAU);
    await expect(page.getByText("Mot de passe actuel incorrect.")).toBeVisible();

    await changer(page, PASSWORD, NOUVEAU);
    await expect(page.getByText("Mot de passe modifié")).toBeVisible();
    // La session courante survit au changement.
    await page.goto("/clients");
    await expect(page).toHaveURL("/clients");

    // L'ancien mot de passe ne vaut plus rien, le nouveau ouvre la porte.
    await page.getByRole("button", { name: "Déconnexion" }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.getByLabel("Mot de passe").fill(PASSWORD);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByText("Mot de passe incorrect.")).toBeVisible();

    await page.getByLabel("Mot de passe").fill(NOUVEAU);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();

    // On repose le mot de passe d'origine pour laisser la base comme on l'a trouvée.
    await changer(page, NOUVEAU, PASSWORD);
    await expect(page.getByText("Mot de passe modifié")).toBeVisible();
  });
});

/**
 * En dernier : une restauration remplace toute la base par l'instantané
 * téléchargé juste avant. Les tests qui précèdent gardent donc leur terrain.
 */
test.describe("restauration", () => {
  test("remet la base dans l'état de la sauvegarde téléchargée", async ({ page }) => {
    await login(page);
    await page.goto("/reglages");

    const [sauvegarde] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "Télécharger le JSON" }).click(),
    ]);
    const fichier = await sauvegarde.path();

    // Une donnée créée après la sauvegarde : elle ne doit pas survivre.
    await page.goto("/clients");
    await page.getByRole("button", { name: "Nouveau client" }).first().click();
    await page.getByLabel("Nom").fill("Client Postérieur");
    await page.getByLabel("TJM (€)").fill("300");
    await page.getByRole("button", { name: "Créer le client" }).click();
    await expect(page.getByRole("link", { name: /Client Postérieur/ })).toBeVisible();

    await page.goto("/reglages");
    // Sans le mot de confirmation, le remplacement reste hors de portée.
    await page.setInputFiles("#backup-file", fichier);
    await expect(page.getByRole("button", { name: "Remplacer les données" })).toBeDisabled();

    await page.getByLabel(/Tapez REMPLACER/).fill("REMPLACER");
    await page.getByRole("button", { name: "Remplacer les données" }).click();
    await expect(page.getByText(/Données remplacées/)).toBeVisible();

    await page.goto("/clients");
    await expect(page.getByRole("link", { name: /Client Postérieur/ })).toHaveCount(0);
    // Et ce qui existait avant la sauvegarde est toujours là.
    await expect(page.getByRole("link", { name: /Client Clôture/ })).toBeVisible();
  });
});
