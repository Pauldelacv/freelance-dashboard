# CLAUDE.md — Freelance Dashboard

> Document de cadrage **à valider avant tout développement**.
> Il sert aussi de mémoire projet pour Claude Code : conventions, architecture, décisions.

---

## 1. Objectif

Un tableau de bord web **mono-utilisateur** (usage perso), auto-hébergé sur un VPS via **Coolify**, qui centralise le pilotage d'une activité de freelance :

1. **Cocher les jours travaillés** dans un calendrier (journée / demi-journée, rattachée à un client).
2. **Gérer les clients** avec leur **TJM** et en déduire automatiquement le CA.
3. **Gérer une liste de sites de veille** (annuaire de liens, catégories, tags, favoris).
4. Une couche de pilotage autour : CA, facturation, objectifs, dépenses.

Principe directeur : **rapide à utiliser au quotidien** (2 clics pour cocher une journée), pas une usine à gaz. Tout ce qui n'est pas utilisé chaque semaine reste optionnel/repliable.

---

## 2. Stack technique

| Couche          | Choix                                                                                  | Pourquoi                                                                  |
| --------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Framework       | **Next.js 15** (App Router, Server Actions) + TypeScript                               | Un seul process front+back, build Docker standalone, parfait pour Coolify |
| UI              | **Tailwind CSS v4** + **shadcn/ui** + lucide-react                                     | Composants sobres, dark mode natif                                        |
| Graphiques      | **Recharts**                                                                           | Léger, suffisant pour CA / jours                                          |
| Calendrier      | Grille mensuelle **maison** (pas de lib lourde)                                        | Le besoin = cocher des cases, pas gérer des events                        |
| Base de données | **SQLite** + volume persistant _(validé)_                                              | 1 fichier = 1 backup, zéro service supplémentaire sur le VPS              |
| ORM             | **Prisma 7** + driver adapter `better-sqlite3`                                         | Migrations propres, changement SQLite→Postgres = 1 adapter                |
| Auth            | Session cookie signée, **mot de passe unique** hashé (argon2)                          | Mono-utilisateur, pas besoin de NextAuth                                  |
| Dates           | **date-fns** + `Europe/Paris`                                                          | Pas de dérive de fuseau sur les jours                                     |
| Tests           | Vitest (logique métier : calculs CA, charges, jours) + Playwright (parcours critiques) | On teste les calculs, pas le CSS                                          |
| Qualité         | ESLint + Prettier + `tsc --noEmit`                                                     | Lancés en CI et avant chaque commit                                       |

### Règles de code

- **Argent stocké en centimes (`Int`)**, jamais en float. Formatage à l'affichage uniquement (`Intl.NumberFormat('fr-FR')`).
- **Dates de jour stockées en `String` ISO `YYYY-MM-DD`**, pas en `DateTime` — évite tout décalage UTC sur « le 1er du mois ».
- Toute mutation passe par une **Server Action** validée avec **Zod**, et commence
  par `requireSession()` : le middleware laisse passer les appels de Server Action
  (une redirection HTTP y est illisible pour le client Next, qui lève « An
  unexpected response was received from the server »), la garde est donc dans
  l'action.
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
  billing   String  @default("pending")  // pending | invoiced | paid  (facture émise dans Indy)
  billedAt  String?  // date de la facture Indy, base du prévisionnel de trésorerie
  paidAt    String?
  @@unique([date, clientId, missionId])
}

model Prospect {
  id           String  @id @default(cuid())
  name         String
  company      String?
  email        String?
  source       String?  // recommandation | LinkedIn | site | réseau…
  stage        String   @default("contacted") // contacted | quoted | won | lost
  estimatedRate Int?    // TJM pressenti, en centimes
  estimatedDays Float?
  probability  Int      @default(50) // en %
  nextAction   String?
  nextActionAt String?
  notes        String?
  clientId     String?  // rempli à la conversion en client
  createdAt    DateTime @default(now())
}

// Optionnel — la comptabilité reste dans Indy. Activable dans les réglages.
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
  value String   // JSON. Clés : tax { chargeRate: 0.261, vat: false }, indyUrl, objectifs par défaut…
}
```

---

## 4. Fonctionnalités

### 4.1 Calendrier des jours travaillés — _cœur du produit_

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
- Fiche client : CA total, CA de l'année, jours travaillés, TJM moyen réel, montant à facturer et encaissements attendus.
- Le TJM est **figé sur chaque `WorkDay`** à la saisie : changer le TJM d'un client ne réécrit pas l'historique.

### 4.3 Facturation → **Indy** (externe)

Aucun moteur de facturation dans l'application : **Indy reste la source de vérité** comptable et fiscale.
Ce que le dashboard fait à la place, en restant minimal :

- **Lien direct vers Indy** dans la barre de navigation et sur chaque fiche client.
- Chaque `WorkDay` porte un statut de facturation : _à facturer → facturé → encaissé_.
- Action **« Clôturer le mois »** sur une fiche client : marque d'un coup tous les jours de la période comme facturés, avec un récapitulatif copiable (nombre de jours, TJM, total HT) à coller dans Indy.
- Le dashboard affiche donc en permanence : **à facturer**, **facturé non encaissé**, **encaissé** — sans jamais dupliquer une facture.

### 4.4 Finances

- CA **prévisionnel** (jours cochés à facturer) vs **facturé** vs **encaissé**.
- Graphiques : CA mensuel sur 12 mois, répartition par client, évolution du TJM moyen réel.
- Suivi des dépenses et estimation des charges : **module optionnel désactivé par défaut** (Indy le fait déjà). Activable dans les réglages si le besoin apparaît.

### 4.5 Veille — annuaire de liens

- Liste des sites : titre, URL, catégorie, tags, favicon récupéré automatiquement, favori.
- Filtres par catégorie/tag, recherche, tri, vue **liste dense** ou **cartes**.
- Ajout rapide : coller une URL, le titre et le favicon sont récupérés automatiquement.
- Marquage de la dernière visite pour repérer les sites délaissés.
- Import/export de la liste en JSON (et OPML pour récupérer un export de lecteur existant).
- _Pas de lecteur RSS_ — décision validée, on reste sur un annuaire.

### 4.6 Objectifs & KPI (page d'accueil)

Bandeau de tuiles : CA du mois vs objectif · jours travaillés vs objectif · TJM moyen · taux d'occupation · **à facturer** · **encaissements attendus ce mois-ci**.
En dessous : calendrier du mois en cours + graphique CA 12 mois + prospects à relancer.

### 4.7 Confort

- **Mot de passe modifiable depuis les réglages.** `APP_PASSWORD_HASH` n'est que
  le mot de passe d'amorçage : le hash courant vit dans la table `Setting` (clé
  `auth`, exclue de la sauvegarde JSON) et l'emporte sur la variable
  d'environnement. Un changement révoque les autres sessions — le middleware
  n'ayant pas accès à la base, la révocation est vérifiée côté Node en comparant
  la date d'émission du jeton (`iat`) à celle du changement.
- **Cookie de session** : `Secure` seulement si la requête arrive réellement en
  HTTPS (`X-Forwarded-Proto`), jamais sur la foi de `NODE_ENV`. Servi en `http://`,
  un cookie `Secure` est jeté sans erreur par le navigateur et le mot de passe est
  redemandé à chaque page.
- **Dark mode** (défaut système).
- **Palette des clients validée** : l'ordre des huit teintes passe les contrôles de
  séparation (daltonisme et vision normale) en clair comme en sombre. Ne pas
  réordonner sans revalider — voir `lib/colors.ts`.
- **PWA** installable sur mobile — cocher ses jours depuis le téléphone.
- Recherche globale `⌘K` (clients, prospects, sites, pages) — insensible aux accents et à la casse, pilotable entièrement au clavier. Appariement isolé dans `lib/search.ts`, testé unitairement.
- **Export CSV** des tables principales (`;` et décimales à la virgule, ouvrable tel quel dans un tableur français) + **backup complet JSON** en 1 clic depuis les réglages. La **restauration** relit ce JSON et **remplace** la base — jamais de fusion, confirmation par le mot `REMPLACER`, version de format inconnue refusée ; le hash du mot de passe n'est ni exporté ni écrasé (`lib/backup.ts`, aller-retour couvert par un test sur deux bases réelles).
- Interface en **français**, montants en euros, **sans TVA** (mention « TVA non applicable, art. 293 B du CGI » sur les récapitulatifs copiables vers Indy).

---

## 5. Modules retenus pour la v1

### 5.1 Simulateur de TJM

« Pour **X € net par mois**, en travaillant **Y jours**, il me faut un TJM de **Z**. »

- Curseurs : revenu net visé, jours travaillés par mois, taux de charges, semaines de congés par an.
- **Paramètres par défaut : 26,1 % de cotisations, non assujetti à la TVA** — donc CA facturé = CA encaissé, aucune TVA à collecter ni à provisionner. Les montants affichés dans toute l'application sont des montants **HT = TTC**.
- Le taux de charges est stocké dans `Setting` (clé `tax`), jamais en dur dans le code : un changement de régime ou de taux se fait depuis les réglages, sans redéploiement.
- Calcul dans les deux sens : _objectif de net → TJM requis_, et _TJM actuel → net estimé_.
- Comparaison avec le **TJM moyen réel** constaté sur les 12 derniers mois : l'écart est affiché explicitement.
- Logique isolée dans `lib/calculations/rate-simulator.ts`, couverte par des tests unitaires.

### 5.2 Pipeline prospects

- Vue **kanban** : Contacté → Devis envoyé → Gagné / Perdu, glisser-déposer entre colonnes.
- Par prospect : TJM pressenti, jours estimés, probabilité, **valeur pondérée** (TJM × jours × probabilité).
- Total pondéré du pipeline affiché en tête de colonne.
- Relances : champ « prochaine action + date », les prospects en retard remontent sur le dashboard.
- Un prospect _Gagné_ se convertit en **client** en un clic, en reprenant ses informations.

### 5.3 Prévisionnel de trésorerie (3 mois)

- Alimenté par les `WorkDay` : les jours _à facturer_ deviennent des encaissements attendus à `fin de mois + délai de paiement du client`, les jours _facturés_ à `date de facture + délai`.
- Courbe des encaissements attendus semaine par semaine sur 12 semaines, empilée par client.
- Distinction visuelle entre **certain** (déjà facturé dans Indy) et **probable** (jours travaillés pas encore facturés).
- Option : inclure le pipeline pondéré en zone hachurée, pour voir le creux à venir.

---

## 4bis. Charte visuelle

> Ajoutée avec la refonte UX/UI. Les règles ci-dessous sont ce qui distingue une
> interface _dessinée_ d'un assemblage de composants par défaut : s'en écarter
> demande une raison, pas une préférence.

**Règle unique dont tout découle : l'interface est en niveaux de gris, la
couleur appartient aux données.** Le châssis — barre latérale, cartes, boutons,
bordures — est neutre. La couleur ne sert qu'à ce qui porte un sens : l'état
d'une somme (à facturer / facturé / encaissé) et l'identité d'un client.

- **Pas de violet de marque.** `--primary` est une encre ardoise sombre et peu
  saturée. Elle doit rester lisible en texte de lien _et_ sobre en aplat, et ne
  jamais être confondue avec le bleu de dataviz `#2a78d6` — d'où sa luminosité
  basse et sa chroma deux fois moindre.
- **Le filet plutôt que l'ombre.** Les cartes se séparent par une bordure d'un
  pixel. L'ombre (`--shadow-overlay`) est réservée à ce qui flotte réellement :
  dialogues, palette de commandes, listes déroulantes.
- **Une hiérarchie, pas une grille de tuiles.** Une rangée de six tuiles
  identiques ne hiérarchise rien. Un écran porte _un_ chiffre principal, puis
  ses constantes vitales en bande dense (`MetricRow`), puis le détail.
- **Un libellé se distingue par sa forme.** `.metric-label` (petit, capitales,
  espacé) plutôt qu'un simple gris : la hiérarchie tient alors en clair comme
  en sombre, sans dépendre du contraste.
- **Les nombres s'alignent.** `.tabular` sur tout montant, colonnes numériques
  à droite. Une liste qu'on compare est un tableau, pas une galerie de cartes.
- **Pas d'icône décorative.** Une icône qui ne fait que redire son libellé est
  du bruit ; elle n'est là que si elle porte une information.
- **Les paliers de surface doivent rester écartés en sombre.** `card` <
  `elevated` < `muted` < `border` : deux paliers trop proches rendent invisible
  l'élément actif posé dessus (cas déjà rencontré sur la palette ⌘K).
- **La palette client de `lib/colors.ts` est validée** : ne pas la réordonner
  (voir §4.7). Les données de démonstration s'y réfèrent par index.

---

## 5bis. Idées gardées en réserve

Non retenues pour la v1, à rouvrir après usage réel :
devis · suivi du temps horaire · journal hebdomadaire de mission · widget « prochaine disponibilité » · rapport mensuel PDF · suivi des dépenses.

## 6. Déploiement Coolify

Contrainte : **déploiement en quelques clics**, sans configuration exotique.

### Livrables d'infra

- `Dockerfile` multi-stage (deps → build → runner) **à la racine** (emplacement attendu par défaut par Coolify), Next.js en `output: "standalone"`, utilisateur non-root.
- Image finale **Node 22 Debian slim** et non Alpine : les binaires précompilés de `better-sqlite3` et de Prisma ciblent la glibc. Alpine imposerait une compilation native à chaque build.
- `docker-compose.yml` pour tester en local à l'identique.
- `.env.example` documenté.
- Route `GET /api/health` renvoyant `{ ok: true }` → **healthcheck Coolify**, sans session ni accès base.
- Migrations appliquées **au démarrage du conteneur** par `scripts/migrate.mjs` : un redéploiement suffit, aucune commande manuelle. Ce script remplace `prisma migrate deploy`, qui exigerait d'embarquer ~150 Mo de CLI Prisma (Studio compris) dans l'image ; il écrit dans `_prisma_migrations` au format exact de Prisma (checksum = sha256 du `migration.sql`), donc `prisma migrate status` reste juste en local. Une migration déjà appliquée puis modifiée fait échouer le démarrage au lieu de corrompre la base.

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

1. Nouvelle ressource → _Application_ → dépôt Git, branche `main`.
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
  db.ts  auth.ts  session.ts  settings.ts  money.ts  dates.ts  holidays.ts  utils.ts
  calculations/           # CA, charges, taux d'occupation — testé unitairement
  queries/                # lectures Prisma agrégées pour les pages
prisma/
  schema.prisma  migrations/  seed.ts
generated/prisma/         # client Prisma généré (hors dépôt)
scripts/
  hash-password.ts  migrate.mjs
Dockerfile  docker-compose.yml  docker/entrypoint.sh
DEPLOY.md
```

---

## 8. Plan de développement

| Phase                      | Contenu                                                                                              | Résultat                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **0 — Socle**              | Next.js + Tailwind + shadcn + Prisma/SQLite + auth + Dockerfile + healthcheck + `DEPLOY.md`          | **Déployable sur Coolify dès la fin de la phase 0** |
| **1 — Cœur**               | Clients + TJM, calendrier des jours travaillés, calculs de CA, statuts de facturation, dashboard KPI | Utilisable au quotidien                             |
| **2 — Veille**             | Annuaire de sites, catégories, tags, favoris, import/export                                          |                                                     |
| **3 — Simulateur de TJM**  | Calcul dans les deux sens + comparaison au TJM réel                                                  |                                                     |
| **4 — Pipeline prospects** | Kanban, valeur pondérée, relances, conversion en client                                              |                                                     |
| **5 — Trésorerie**         | Prévisionnel 12 semaines, graphiques CA, objectifs                                                   |                                                     |
| **6 — Confort**            | PWA, `⌘K`, dark mode, export CSV + backup JSON                                                       |                                                     |

Chaque phase = une série de commits sur `claude/freelance-dashboard-sehxjx`, testée et déployable.

---

## 9. Décisions prises / points restants

**Validé le 25/08/2026 :**

- Base de données : **SQLite**.
- Facturation : **externalisée dans Indy**, simple lien + statuts de facturation côté dashboard.
- Veille : **annuaire de liens**, sans lecteur RSS.
- Modules v1 : **simulateur de TJM**, **pipeline prospects**, **prévisionnel de trésorerie**.
- Régime fiscal : **26,1 % de cotisations**, **non assujetti à la TVA** (franchise en base, art. 293 B du CGI). Valeurs par défaut du simulateur, modifiables dans les réglages.

**Reste à préciser (n'empêche pas de démarrer les phases 0 à 2) :**

1. **Format de TJM** : uniquement journalier, ou aussi horaire / forfait mission ? Par défaut : journalier + demi-journée.
2. **Nom de domaine** sur le VPS, pour `NEXT_PUBLIC_APP_URL`.
3. **URL de ton espace Indy**, pour les liens directs (à mettre dans les réglages, pas dans le dépôt).

## 10. Conventions pour Claude Code

- Toujours développer sur `claude/freelance-dashboard-sehxjx`.
- Avant commit : `npm run check` (lint + typecheck + tests). Les parcours
  critiques se rejouent avec `npm run e2e`.
- Préférer une modification de fichier vérifiée (l'outil échoue si le motif a
  changé) à un remplacement de chaîne silencieux : Prettier réordonne les classes
  Tailwind, et un `replace` peut ne rien remplacer sans prévenir.
- Commits en français, format `type(scope): description` (`feat(calendrier): sélection par glissement`).
- Aucune donnée personnelle, aucun secret dans le dépôt — tout passe par les variables d'environnement.
- Ne jamais casser une migration Prisma déjà appliquée : toujours une nouvelle migration.
- Un module = un dossier de composants + un fichier de calculs testé.
