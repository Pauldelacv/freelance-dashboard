# Freelance Dashboard

Tableau de bord mono-utilisateur, auto-hébergé : jours travaillés, clients & TJM,
veille, prospects et prévisionnel de trésorerie.

- **Cadrage et conventions** : [`CLAUDE.md`](./CLAUDE.md)
- **Mise en ligne sur Coolify** : [`DEPLOY.md`](./DEPLOY.md)

## Démarrer en local

```bash
npm install
cp .env.example .env          # puis renseigner les deux secrets
npm run hash-password         # génère APP_PASSWORD_HASH et SESSION_SECRET
npm run db:migrate            # crée la base SQLite locale
npm run dev                   # http://localhost:3000
```

> Dans un fichier `.env`, les `$` du hash argon2 doivent être échappés (`\$`).
> `npm run hash-password` affiche directement la ligne prête à coller.

Jeu de données de démonstration, facultatif :

```bash
SEED_DEMO=1 npm run db:seed
```

## Commandes

| Commande                      | Rôle                                                    |
| ----------------------------- | ------------------------------------------------------- |
| `npm run dev`                 | serveur de développement                                |
| `npm run build` / `npm start` | build de production et exécution                        |
| `npm run check`               | lint + typecheck + tests unitaires                      |
| `npm test`                    | tests unitaires (Vitest) — calculs métier               |
| `npm run e2e`                 | parcours critiques (Playwright) sur le build standalone |
| `npm run db:migrate`          | nouvelle migration Prisma                               |
| `npm run db:studio`           | explorateur de base                                     |
| `npm run hash-password`       | génère le hash du mot de passe et un secret de session  |

`npm run check` et `npm run e2e` sont rejoués par GitHub Actions à chaque
poussée, avec un `docker build` en prime : voir `.github/workflows/ci.yml`.

## Ce que fait l'application

- **Calendrier** — un clic pose une journée pour le client actif, `Maj`+clic une
  demi-journée, le clic-glissé un rectangle de cases (du lundi au vendredi sur
  plusieurs semaines, sans les week-ends). Week-ends et jours fériés français
  grisés. Le TJM est figé sur chaque jour à la saisie, et le pied de page donne
  le CA du mois avec son net estimé.
- **Clients** — TJM par défaut, couleur, délai de paiement, CA et jours par client.
- **Missions** — en régie (TJM × jours cochés) ou au forfait : un montant unique
  convenu d'avance, avec son propre suivi de facturation.
- **Facturation** — aucune facture n'est émise ici : Indy reste la source de vérité.
  Chaque mois se clôture en un clic (à facturer → facturé → encaissé) avec un
  récapitulatif copiable.
- **Trésorerie** — encaissements attendus sur 12 semaines, certains vs probables.
- **Simulateur de TJM** — du net visé au TJM nécessaire, et l'inverse.
- **Prospects** — kanban, valeur pondérée, relances.
- **Veille** — annuaire de liens, titre et favicon récupérés automatiquement.
- **Réglages** — objectifs, fiscalité, lien Indy, export CSV et sauvegarde JSON.

Interface en français, montants en euros, mode sombre, installable en PWA.

<img width="1440" height="788" alt="Capture d’écran 2026-08-25 à 21 04 17" src="https://github.com/user-attachments/assets/ff4ed144-4ee3-4a96-8b40-a99f0c80869e" />
