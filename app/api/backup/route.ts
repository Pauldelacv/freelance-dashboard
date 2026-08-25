import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { AUTH_SETTING_KEY } from "@/lib/credentials";
import { isAuthenticated } from "@/lib/auth";
import { todayIso } from "@/lib/dates";

export const dynamic = "force-dynamic";

/**
 * Sauvegarde complète en JSON, tables comprises.
 * Le vrai filet reste le fichier SQLite du volume /data (voir DEPLOY.md) :
 * cet export sert à emporter ses données ailleurs.
 */
export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const [clients, missions, workDays, prospects, expenses, watchSites, goals, settings] =
    await Promise.all([
      prisma.client.findMany(),
      prisma.mission.findMany(),
      prisma.workDay.findMany(),
      prisma.prospect.findMany(),
      prisma.expense.findMany(),
      prisma.watchSite.findMany(),
      prisma.goal.findMany(),
      // Le hash du mot de passe est exclu : une sauvegarde s'échange, un secret non.
      prisma.setting.findMany({ where: { key: { not: AUTH_SETTING_KEY } } }),
    ]);

  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    clients,
    missions,
    workDays,
    prospects,
    expenses,
    watchSites,
    goals,
    settings,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="sauvegarde-${todayIso()}.json"`,
    },
  });
}
