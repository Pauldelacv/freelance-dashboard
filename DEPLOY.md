# Déploiement sur Coolify

Guide pas à pas pour mettre le dashboard en ligne sur un VPS équipé de Coolify.
Compter une dizaine de minutes la première fois.

---

## 1. Ce qu'il faut avant de commencer

- Un VPS avec **Coolify** installé et un serveur connecté.
- Un **nom de domaine** (ou sous-domaine) pointant vers l'IP du VPS, par exemple
  `dashboard.mon-domaine.fr` → `A` → `1.2.3.4`.
- Ce dépôt accessible depuis Coolify (GitHub, GitLab, ou dépôt privé via clé de déploiement).

Rien d'autre : pas de base de données à provisionner, pas de service annexe.
La base est un fichier SQLite posé dans le volume persistant.

---

## 2. Générer le mot de passe et le secret de session

Sur votre machine, dans le dépôt :

```bash
npm install
npm run hash-password
```

Saisissez le mot de passe de connexion. La commande affiche deux lignes :

```
APP_PASSWORD_HASH=$argon2id$v=19$m=19456,t=2,p=1$...
SESSION_SECRET=xY3f...
```

Gardez-les de côté pour l'étape 4. Le mot de passe en clair n'est stocké nulle part :
seul son hash argon2 voyage jusqu'au serveur.

---

## 3. Créer la ressource dans Coolify

1. **+ New** → **Application**.
2. Source : votre dépôt Git, branche `main`.
3. **Build Pack : `Dockerfile`** (le `Dockerfile` est à la racine du dépôt).
4. **Port exposé : `3000`**.
5. **Health check path : `/api/health`** (l'image embarque déjà son propre
   `HEALTHCHECK`, mais Coolify utilise le sien pour piloter le déploiement).

---

## 4. Variables d'environnement

Onglet **Environment Variables**, ajouter :

| Variable              | Valeur                             | Remarque                                          |
| --------------------- | ---------------------------------- | ------------------------------------------------- |
| `APP_PASSWORD_HASH`   | le hash argon2 de l'étape 2        | **Build variable : non.** Runtime uniquement      |
| `SESSION_SECRET`      | la chaîne aléatoire de l'étape 2   | en changer déconnecte toutes les sessions         |
| `DATABASE_URL`        | `file:/data/app.db`                | doit pointer dans le volume                       |
| `TZ`                  | `Europe/Paris`                     | les jours travaillés sont datés en heure de Paris |
| `NEXT_PUBLIC_APP_URL` | `https://dashboard.mon-domaine.fr` | votre domaine                                     |

Le `$` du hash argon2 n'a pas besoin d'être échappé dans l'interface Coolify.

---

## 5. Volume persistant — l'étape à ne pas rater

Onglet **Storages** → **Add** :

- **Name** : `data`
- **Destination Path** : `/data`

`/data` contient la base SQLite. **C'est le seul chemin à sauvegarder**, et le
seul dont la perte serait irréversible. Sans ce volume, les données sont
effacées à chaque redéploiement.

---

## 6. Domaine et HTTPS

Onglet **Domains** : renseigner `https://dashboard.mon-domaine.fr`.
Coolify demande et renouvelle le certificat Let's Encrypt automatiquement.

---

## 7. Déployer

Cliquer sur **Deploy**. Au premier démarrage, les logs affichent :

```
→ Application des migrations…
✓ migration appliquée : 20260825065326_init
→ Démarrage de Next.js sur le port 3000
```

Vérifications :

```bash
curl https://dashboard.mon-domaine.fr/api/health
# {"ok":true,"service":"freelance-dashboard"}
```

Puis ouvrir le domaine : vous devez arriver sur l'écran de connexion.
Si l'écran affiche « Configuration incomplète », c'est qu'une variable de
l'étape 4 manque — le nom de la variable est indiqué à l'écran.

---

## 8. Mises à jour

Un `git push` sur `main` suffit si le déploiement automatique est activé,
sinon **Redeploy** dans Coolify. Les migrations en attente sont appliquées au
démarrage du conteneur : aucune commande manuelle, jamais.

Une migration déjà appliquée qui aurait été modifiée fait **échouer volontairement**
le démarrage, avec un message explicite : le conteneur précédent continue de
tourner, rien n'est corrompu.

---

## 9. Sauvegarde et restauration

La base entière tient dans un fichier.

```bash
# Sauvegarde (depuis le VPS)
docker cp <conteneur>:/data/app.db ./app-$(date +%F).db

# Restauration
docker cp ./app-2026-08-25.db <conteneur>:/data/app.db
# puis redémarrer le conteneur depuis Coolify
```

Deux fichiers annexes (`app.db-wal`, `app.db-shm`) peuvent exister : les copier
aussi si le conteneur tourne, ou arrêter le conteneur avant la copie pour n'avoir
que `app.db`.

Coolify sait aussi sauvegarder un volume vers S3 : **Storages → Backups**.
L'application proposera en plus un export JSON complet depuis les réglages (phase 6).

---

## 10. Tester en local à l'identique

```bash
cp .env.example .env     # puis renseigner APP_PASSWORD_HASH et SESSION_SECRET
docker compose up --build
```

L'application écoute sur http://localhost:3000 avec un volume Docker nommé,
exactement comme en production.

---

## 11. Dépannage

**Le healthcheck reste rouge.**
Regarder les logs Coolify. Une erreur de migration s'affiche en clair au démarrage.
Vérifier que `DATABASE_URL` vaut bien `file:/data/app.db` et que le volume `/data`
est monté.

**« Configuration incomplète » à l'écran de connexion.**
`APP_PASSWORD_HASH` ou `SESSION_SECRET` n'est pas défini côté runtime. Attention
à ne pas les avoir cochés « Build variable » uniquement.

**Mot de passe oublié.**
Relancer `npm run hash-password`, remplacer `APP_PASSWORD_HASH` dans Coolify,
redéployer. Aucune donnée n'est perdue.

**Repartir d'une base vierge.**
Supprimer `/data/app.db` (et les fichiers `-wal`/`-shm`) puis redémarrer : les
migrations recréent un schéma vide.

**Erreur `SQLITE_BUSY` ou base verrouillée.**
Ne jamais faire tourner deux conteneurs sur le même volume : SQLite n'accepte
qu'un seul processus écrivain. Garder `replicas: 1` dans Coolify.
