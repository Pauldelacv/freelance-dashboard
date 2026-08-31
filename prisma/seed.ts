/**
 * Seed minimal : uniquement la ligne de réglages par défaut.
 * `SEED_DEMO=1 npm run db:seed` ajoute en plus un jeu de données de démonstration
 * (jamais exécuté automatiquement : la base de production doit rester vierge).
 */
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";
import { CLIENT_COLORS } from "../lib/colors";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }),
});

const DEFAULT_SETTINGS = {
  indyUrl: "",
  tax: { chargeRate: 0.261, vat: false, vatRate: 0.2 },
  modules: { expenses: false },
  goals: { monthlyRevenue: null, monthlyDays: null },
  workday: { defaultFraction: 1 },
};

async function seedDemo() {
  const acme = await prisma.client.create({
    data: {
      name: "Agence Nord",
      company: "Nord SAS",
      email: "contact@exemple.fr",
      defaultRate: 55000,
      color: CLIENT_COLORS[0],
      paymentTerms: 30,
      notes: "Client de démonstration.",
    },
  });

  const studio = await prisma.client.create({
    data: {
      name: "Studio Kappa",
      defaultRate: 65000,
      color: CLIENT_COLORS[1],
      paymentTerms: 45,
    },
  });

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const pad = (value: number) => String(value).padStart(2, "0");

  for (let day = 1; day <= 12; day += 1) {
    const date = `${year}-${pad(month)}-${pad(day)}`;
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    const client = day % 3 === 0 ? studio : acme;
    await prisma.workDay.create({
      data: {
        date,
        fraction: day % 7 === 0 ? 0.5 : 1,
        clientId: client.id,
        rate: client.defaultRate,
        type: "billable",
        billing: day <= 5 ? "invoiced" : "pending",
        billedAt: day <= 5 ? `${year}-${pad(month)}-05` : null,
      },
    });
  }

  // Une mission au forfait : un montant unique, sans jour à cocher — le cas que
  // la régie ne sait pas représenter.
  await prisma.mission.create({
    data: {
      clientId: studio.id,
      title: "Refonte de l'identité",
      billingType: "forfait",
      forfaitAmount: 450000,
      startDate: `${year}-${pad(month)}-01`,
      endDate: `${year}-${pad(month)}-28`,
      status: "active",
    },
  });

  await prisma.prospect.createMany({
    data: [
      {
        name: "Refonte site vitrine",
        company: "Maison Bleue",
        stage: "quoted",
        estimatedRate: 60000,
        estimatedDays: 12,
        probability: 60,
        nextAction: "Relancer le devis",
        nextActionAt: `${year}-${pad(month)}-${pad(Math.min(28, today.getDate() + 3))}`,
      },
      {
        name: "Audit performance",
        company: "Coop Verte",
        stage: "contacted",
        estimatedRate: 65000,
        estimatedDays: 5,
        probability: 30,
      },
    ],
  });

  await prisma.watchSite.createMany({
    data: [
      {
        title: "Next.js Blog",
        url: "https://nextjs.org/blog",
        category: "Technique",
        tags: "next,react",
      },
      {
        title: "Coolify",
        url: "https://coolify.io",
        category: "Infra",
        tags: "devops",
        favorite: true,
      },
      {
        title: "Indy",
        url: "https://www.indy.fr",
        category: "Gestion",
        tags: "compta,facturation",
      },
    ],
  });

  console.log("✓ Données de démonstration insérées");
}

async function main() {
  const value = JSON.stringify(DEFAULT_SETTINGS);
  await prisma.setting.upsert({
    where: { key: "app" },
    create: { key: "app", value },
    update: {},
  });
  console.log("✓ Réglages par défaut en place");

  if (process.env.SEED_DEMO === "1") await seedDemo();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
