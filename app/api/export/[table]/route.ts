import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import { todayIso } from "@/lib/dates";
import { csvMoney, csvNumber, toCsv, type CsvValue } from "@/lib/export";

export const dynamic = "force-dynamic";

const DAY_TYPES: Record<string, string> = {
  billable: "facturable",
  internal: "interne",
  training: "formation",
  off: "congé",
};

const BILLING: Record<string, string> = {
  pending: "à facturer",
  invoiced: "facturé",
  paid: "encaissé",
};

const STAGES: Record<string, string> = {
  contacted: "contacté",
  quoted: "devis envoyé",
  won: "gagné",
  lost: "perdu",
};

async function buildCsv(table: string): Promise<{ csv: string } | null> {
  switch (table) {
    case "jours": {
      const days = await prisma.workDay.findMany({
        orderBy: { date: "asc" },
        include: { client: { select: { name: true } }, mission: { select: { title: true } } },
      });
      return {
        csv: toCsv(
          [
            "date",
            "client",
            "mission",
            "durée",
            "type",
            "TJM",
            "montant",
            "facturation",
            "facturé le",
            "encaissé le",
            "note",
          ],
          days.map((day): CsvValue[] => [
            day.date,
            day.client?.name ?? "",
            day.mission?.title ?? "",
            csvNumber(day.fraction),
            DAY_TYPES[day.type] ?? day.type,
            csvMoney(day.rate),
            day.type === "billable" ? csvMoney(Math.round(day.rate * day.fraction)) : "0,00",
            BILLING[day.billing] ?? day.billing,
            day.billedAt,
            day.paidAt,
            day.note,
          ]),
        ),
      };
    }
    case "clients": {
      const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });
      return {
        csv: toCsv(
          ["nom", "société", "e-mail", "téléphone", "TJM", "délai de paiement", "statut", "notes"],
          clients.map((client): CsvValue[] => [
            client.name,
            client.company,
            client.email,
            client.phone,
            csvMoney(client.defaultRate),
            client.paymentTerms,
            client.status,
            client.notes,
          ]),
        ),
      };
    }
    case "prospects": {
      const prospects = await prisma.prospect.findMany({ orderBy: { createdAt: "asc" } });
      return {
        csv: toCsv(
          [
            "intitulé",
            "société",
            "e-mail",
            "source",
            "étape",
            "TJM pressenti",
            "jours estimés",
            "probabilité",
            "prochaine action",
            "date",
          ],
          prospects.map((prospect): CsvValue[] => [
            prospect.name,
            prospect.company,
            prospect.email,
            prospect.source,
            STAGES[prospect.stage] ?? prospect.stage,
            prospect.estimatedRate === null ? "" : csvMoney(prospect.estimatedRate),
            prospect.estimatedDays === null ? "" : csvNumber(prospect.estimatedDays),
            `${prospect.probability} %`,
            prospect.nextAction,
            prospect.nextActionAt,
          ]),
        ),
      };
    }
    case "veille": {
      const sites = await prisma.watchSite.findMany({ orderBy: { title: "asc" } });
      return {
        csv: toCsv(
          ["titre", "url", "catégorie", "tags", "fréquence", "favori", "dernière visite"],
          sites.map((site): CsvValue[] => [
            site.title,
            site.url,
            site.category,
            site.tags,
            site.frequency,
            site.favorite,
            site.lastVisit,
          ]),
        ),
      };
    }
    default:
      return null;
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ table: string }> }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { table } = await params;
  const result = await buildCsv(table);
  if (!result) return NextResponse.json({ error: "Table inconnue." }, { status: 404 });

  return new NextResponse(result.csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${table}-${todayIso()}.csv"`,
    },
  });
}
