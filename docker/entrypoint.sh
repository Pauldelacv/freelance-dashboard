#!/bin/sh
set -e

echo "→ Application des migrations…"
node scripts/migrate.mjs

echo "→ Démarrage de Next.js sur le port ${PORT:-3000}"
exec node server.js
