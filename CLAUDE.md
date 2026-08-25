# CLAUDE.md — Freelance Dashboard

> Document de cadrage **à valider avant tout développement**.
> Il sert aussi de mémoire projet pour Claude Code : conventions, architecture, décisions.

---

## 1. Objectif

Un tableau de bord web **mono-utilisateur** (usage perso), auto-hébergé sur un VPS via **Coolify**, qui centralise le pilotage d'une activité de freelance :

1. **Cocher les jours travaillés** dans un calendrier (journée / demi-journée, rattachée à un client).
2. **Gérer les clients** avec leur **TJM** et en déduire automatiquement le CA.
3. **Gérer une liste de sites de veille** (liens, catégories, flux RSS).
4. Une couche de pilotage autour : CA, facturation, objectifs, dépenses.

Principe directeur : **rapide à utiliser au quotidien** (2 clics pour cocher une journée), pas une usine à gaz. Tout ce qui n'est pas utilisé chaque semaine reste optionnel/repliable.

---

## 2. Stack technique

| Couche | Choix | Pourquoi |
|---|---|---|
| Framework | **Next.js 15** (App Router, Server Actions) + TypeScript | Un seul process front+back, build Docker standalone, parfait pour Coolify |
| UI | **Tailwind CSS v4** + **shadcn/ui** + lucide-react | Composants sobres, dark mode natif |
| Graphiques | **Recharts** | Léger, suffisant pour CA / jours |
| Calendrier | Grille mensuelle **maison** (pas de lib lourde) | Le besoin = cocher des cases, pas gérer des events |
| Base de données | **SQLite** + volume persistant (défaut) — bascule Postgres possible | 1 fichier = 1 backup, zéro service supplémentaire sur le VPS |
| ORM | **Prisma** | Migrations propres, changement SQLite→Postgres = 1 ligne |
| Auth | Session cookie signée, **mot de passe unique** hashé (argon2) en variable d'env | Mono-utilisateur, pas besoin de NextAuth |
| Dates | **date-fns** + `Europe/Paris` | Pas de dérive de fuseau sur les jours |
| Tests | Vitest (logique métier : calculs CA, charges, jours) + Playwright (parcours critiques) | On teste les calculs, pas le CSS |
| Qualité | ESLint + Prettier + `tsc --noEmit` | Lancés en CI et avant chaque commit |

### Règles de code
- **Argent stocké en centimes (`Int`)**, jamais en float. Formatage à l'affichage uniquement (`Intl.NumberFormat('fr-FR')`).
- **Dates de jour stockées en `String` ISO `YYYY-MM-DD`**, pas en `DateTime` — évite tout décalage UTC sur « le 1er du mois ».
- Toute mutation passe par une **Server Action** validée avec **Zod**.
- Pas de `any`. Pas de fetch client si un Server Component suffit.
- Fichiers en `kebab-case`, composants en `PascalCase`, un composant par fichier.

---

## 3. Modèle de données (Prisma)

```prisma
model Client {
  id            String   @id @default(cuid())
  name          String
  company       String?
  email         String?
  phone         String?
  defaultRate   Int      // TJM par défaut, en centimes
  currency      String   @default("EUR")
  color         String   // pastille couleur dans le calendrier
  status        String   @default("active") // active | prospect | archived
  paymentTerms  Int      @default(30)       // délai de paiement en jours
  notes         String?
  createdAt     DateTime @default(now())
  missions      Mission[]
  workDays      WorkDay[]
  invoices      Invoice[]
}

model Mission {
  id          String   @id @default(cuid())
  clientId    String
  title       String
  rate        Int?     // TJM spécifique, sinon celui du client
  startDate   String?
  endDate     String?
  estimatedDays Float?
  status      String   @default("active") // active | done | paused
  client      Client   @relation(fields: [clientId], references: [id])
  workDays    WorkDay[]
}

model WorkDay {
  id        String  @id @default(cuid())
  date      String  // "2026-08-25"
  fraction  Float   @default(1)   // 1 = journée, 0.5 = demi-journée
  clientId  String?
  missionId String?
  rate      Int     // TJM figé au moment de la saisie (historique fiable)
  type      String  @default("billable") // billable | internal | training | off
  note      String?
  invoiceId String?  // rattachement une fois facturé
  @@unique([date, clientId, missionId])
}

model Invoice {
  id         String   @id @default(cuid())
  number     String   @unique      // FA-2026-001
  clientId   String
  issueDate  String
  dueDate    String
  status     String   @default("draft") // draft | sent | paid | late | cancelled
  vatRate    Int      @default(0)   // en points de base (2000 = 20 %)
  paidAt     String?
  notes      String?
  lines      InvoiceLine[]
  workDays   WorkDay[]
}

model InvoiceLine {
  id        String @id @default(cuid())
  invoiceId String
  label     String
  quantity  Float
  unitPrice Int
}

model Expense {
  id         String  @id @default(cuid())
  date       String
  label      String
  amount     Int
  category   String  // logiciel | matériel | déplacement | formation | compta | autre
  recurring  Boolean @default(false)
  receiptUrl String?
}

model WatchSite {
  id         String   @id @default(cuid())
  title      String
  url        String
  rssUrl     String?
  category   String
  tags       String   // CSV simple
  frequency  String?  // quotidien | hebdo | mensuel
  favorite   Boolean  @default(false)
  lastVisit  String?
  faviconUrl String?
  createdAt  DateTime @default(now())
}

model Goal {
  id      String @id @default(cuid())
  year    Int
  month   Int?          // null = objectif annuel
  revenueTarget Int?
  daysTarget    Float?
}

model Setting {
  key   String @id
  value String   // JSON : identité, mentions légales facture, régime fiscal, taux de charges…
}
```

---

## 4. Fonctionnalités

### 4.1 Calendrier des jours travaillés — *cœur du produit*
- Grille mensuelle, navigation mois précédent/suivant, raccourcis clavier `←`/`→`.
- **Clic sur un jour = coché/décoché** avec le client actif (sélecteur en haut). **Shift+clic** = demi-journée. **Clic-glissé** = cocher une plage.
- Pastille de couleur du client, montant du jour affiché au survol.
- Week-ends et **jours fériés français** grisés (calcul local, sans API externe) mais cochables.
- Types de journée : facturable, interne (admin/proso), formation, congé.
- Totaux du mois en pied de calendrier : jours facturables, CA du mois, taux d'occupation (jours travaillés / jours ouvrés).
- Vue annuelle « heatmap » en lecture seule.

### 4.2 Clients & TJM
- CRUD client : nom, société, contact, **TJM par défaut**, couleur, délai de paiement, statut, notes.
- Missions rattachées avec TJM spécifique qui écrase celui du client.
- Fiche client : CA total, CA de l'année, jours travaillés, TJM moyen réel, factures en attente.
- Le TJM est **figé sur chaque `WorkDay`** à la saisie : changer le TJM d'un client ne réécrit pas l'historique.

### 4.3 Facturation
- Génération d'une facture depuis les jours non facturés d'un client sur une période (1 clic).
- Numérotation automatique `FA-{année}-{séquence}`, statuts brouillon → envoyée → payée, marquage automatique **en retard** après échéance.
- Export **PDF** (rendu HTML → PDF côté serveur), avec identité, mentions légales, TVA ou mention « TVA non applicable, art. 293 B du CGI ».
- Tableau de bord des impayés + total en attente d'encaissement.

### 4.4 Finances
- CA **facturé** vs **encaissé** vs **prévisionnel** (jours cochés non encore facturés).
- Dépenses par catégorie, récurrentes ou ponctuelles.
- Estimation des charges sociales/impôts selon le régime configuré (micro-BNC / EI / SASU) → **net estimé**.
- Provision TVA si assujetti.
- Graphiques : CA mensuel sur 12 mois, répartition par client, évolution du TJM moyen.

### 4.5 Veille
- Liste des sites : titre, URL, catégorie, tags, favicon récupéré automatiquement, favori.
- Filtres par catégorie/tag, recherche, tri, vue **liste dense** ou **cartes**.
- Optionnel (phase 3) : lecteur **RSS** intégré — récupération périodique des derniers articles des flux renseignés, marquage lu/non lu, ouverture externe.
- Import/export de la liste en JSON/OPML.

### 4.6 Objectifs & KPI (page d'accueil)
Bandeau de tuiles : CA du mois vs objectif · jours travaillés vs objectif · TJM moyen · taux d'occupation · impayés · prochaine échéance.
En dessous : calendrier du mois en cours + graphique CA 12 mois + factures à relancer.

### 4.7 Confort
- **Dark mode** (défaut système).
- **PWA** installable sur mobile — cocher ses jours depuis le téléphone.
- Recherche globale `⌘K` (clients, factures, sites).
- **Export CSV** de toutes les tables + **backup complet JSON** en 1 clic depuis les réglages.
- Interface en **français**, montants en euros.

---

## 5. Idées supplémentaires proposées

À arbitrer — chacune est un module indépendant, cochable dans les réglages :

1. **Pipeline prospects** (CRM léger) : colonnes Contacté → Devis envoyé → Gagné/Perdu, avec valeur estimée.
2. **Devis** : même moteur que la facture, convertible en facture en un clic.
3. **Suivi du temps** : chrono par mission pour les clients au forfait ou horaires.
4. **Rappels de relance** : liste des factures dépassant l'échéance + brouillon de mail de relance pré-rempli.
5. **Simulateur de TJM** : « pour X € net/mois avec Y jours travaillés, il faut un TJM de Z ».
6. **Prévisionnel de trésorerie** à 3 mois basé sur les factures émises et les délais de paiement.
7. **Journal / notes hebdo** : ce qui a été fait, à ressortir en fin de mission.
8. **Widget disponibilités** : « premier créneau libre », utile pour répondre à un prospect.
9. **Rapport mensuel PDF** : synthèse à archiver ou envoyer au comptable.

---

## 6. Déploiement Coolify

Contrainte : **déploiement en quelques clics**, sans configuration exotique.

### Livrables d'infra
- `Dockerfile` multi-stage (deps → build → runner), Next.js en `output: "standalone"`, image finale Node 22 Alpine, utilisateur non-root.
- `docker-compose.yml` pour tester en local à l'identique.
- `.env.example` documenté.
- Route `GET /api/health` renvoyant `{ ok: true }` → **healthcheck Coolify**.
- Migrations Prisma appliquées **au démarrage du conteneur** (`prisma migrate deploy`) : un redéploiement suffit, aucune commande manuelle.

### Variables d'environnement
```
APP_PASSWORD_HASH=   # hash argon2 du mot de passe (script fourni : npm run hash-password)
SESSION_SECRET=      # 32+ caractères aléatoires
DATABASE_URL=file:/data/app.db
TZ=Europe/Paris
NEXT_PUBLIC_APP_URL=https://dashboard.mon-domaine.fr
```

### Volume persistant
`/data` → volume Coolify. Contient la base SQLite et les PDF générés. **C'est le seul chemin à sauvegarder.**

### Procédure Coolify
1. Nouvelle ressource → *Application* → dépôt Git, branche `main`.
2. Build pack : **Dockerfile**.
3. Port exposé : `3000`. Healthcheck : `/api/health`.
4. Ajouter le volume persistant `/data`.
5. Renseigner les variables d'environnement.
6. Domaine + certificat Let's Encrypt automatique.

Le tout sera documenté pas à pas dans un `DEPLOY.md`.

---

## 7. Structure du projet

```
app/
  (auth)/login/
  (app)/
    page.tsx              # dashboard
    calendrier/
    clients/[id]/
    factures/[id]/
    finances/
    veille/
    reglages/
  api/health/
components/
  ui/                     # shadcn
  calendar/ clients/ invoices/ watch/ charts/
lib/
  db.ts  auth.ts  money.ts  dates.ts  holidays.ts
  calculations/           # CA, charges, taux d'occupation — testé unitairement
prisma/
  schema.prisma  migrations/  seed.ts
docker/  Dockerfile  docker-compose.yml
DEPLOY.md
```

---

## 8. Plan de développement

| Phase | Contenu | Résultat |
|---|---|---|
| **0 — Socle** | Next.js + Tailwind + shadcn + Prisma + auth + Dockerfile + healthcheck + `DEPLOY.md` | **Déployable sur Coolify dès la fin de la phase 0** |
| **1 — Cœur** | Clients + TJM, calendrier des jours travaillés, calculs de CA, dashboard KPI | Utilisable au quotidien |
| **2 — Veille** | Sites de veille, catégories, tags, favoris, import/export | |
| **3 — Facturation** | Factures, PDF, statuts, impayés | |
| **4 — Finances** | Dépenses, charges, objectifs, graphiques | |
| **5 — Options** | Modules de la section 5 retenus, PWA, `⌘K`, backup | |

Chaque phase = une série de commits sur `claude/freelance-dashboard-sehxjx`, testée et déployable.

---

## 9. Points à valider avant de coder

1. **Base de données** : SQLite (simple, 1 fichier, backup trivial) ou PostgreSQL (service Coolify séparé) ? → *recommandation : SQLite*.
2. **Régime fiscal** pour l'estimation des charges : micro-BNC / micro-BIC / EI au réel / SASU ? Assujetti à la TVA ?
3. **Facturation** : nécessaire dès maintenant, ou déjà géré par un outil externe (Freebe, Henrri, Abby…) ? Si externe, on garde uniquement le suivi CA/jours.
4. **Lecteur RSS** dans la veille, ou simple annuaire de liens ?
5. **Modules de la section 5** à retenir pour la v1.
6. **Format de TJM** : uniquement journalier, ou aussi horaire / forfait mission ?
7. **Nom de domaine** prévu sur le VPS (pour `NEXT_PUBLIC_APP_URL` et les mentions de facture).
8. **Identité de facturation** (nom, SIRET, adresse, IBAN) — à renseigner plus tard dans les réglages, jamais en dur dans le dépôt.

---

## 10. Conventions pour Claude Code

- Toujours développer sur `claude/freelance-dashboard-sehxjx`.
- Avant commit : `npm run lint && npx tsc --noEmit && npm test`.
- Commits en français, format `type(scope): description` (`feat(calendrier): sélection par glissement`).
- Aucune donnée personnelle, aucun secret dans le dépôt — tout passe par les variables d'environnement.
- Ne jamais casser une migration Prisma déjà appliquée : toujours une nouvelle migration.
- Un module = un dossier de composants + un fichier de calculs testé.
