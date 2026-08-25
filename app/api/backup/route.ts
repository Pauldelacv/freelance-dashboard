import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { collectBackup } from "@/lib/backup";
import { isAuthenticated } from "@/lib/auth";
import { todayIso } from "@/lib/dates";

export const dynamic = "force-dynamic";

/**
 * Sauvegarde complète en JSON, tables comprises.
 * Le vrai filet reste le fichier SQLite du volume /data (voir DEPLOY.md) :
 * cet export sert à emporter ses données ailleurs — et à les remettre, par
 * « Réglages → Restauration », qui relit exactement ce fichier (`lib/backup.ts`).
 */
export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const payload = await collectBackup(prisma);

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="sauvegarde-${todayIso()}.json"`,
    },
  });
}
