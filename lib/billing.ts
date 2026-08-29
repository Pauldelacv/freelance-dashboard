import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { todayIso } from "@/lib/dates";

/**
 * Mutations de facturation partagées par la fiche client et le tableau de bord.
 *
 * La facture elle-même reste dans Indy : ici on ne déplace qu'un statut, et il
 * faut que les deux écrans le déplacent exactement de la même façon — d'où ce
 * fichier plutôt qu'une clause `where` recopiée.
 */

/** Bornes d'un mois « AAAA-MM » pour un filtre sur `date` (stockée en ISO). */
export function monthRange(month: string) {
  return { gte: `${month}-01`, lte: `${month}-31` };
}

/** Un statut de facturation qui bouge change tous les écrans qui l'agrègent. */
export function revalidateBilling(clientId: string | null) {
  if (clientId) revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  revalidatePath("/calendrier");
  revalidatePath("/tresorerie");
  revalidatePath("/");
}

/**
 * Passe « facturé » → « encaissé » sur un mois d'un client.
 * `clientId` à `null` vise les jours saisis sans client.
 */
export async function markPeriodPaid(clientId: string | null, month: string): Promise<number> {
  const result = await prisma.workDay.updateMany({
    where: { clientId, billing: "invoiced", date: monthRange(month) },
    data: { billing: "paid", paidAt: todayIso() },
  });

  revalidateBilling(clientId);
  return result.count;
}

/** Retour en arrière : « encaissé » → « facturé », pour un pointage erroné. */
export async function markPeriodUnpaid(clientId: string | null, month: string): Promise<number> {
  const result = await prisma.workDay.updateMany({
    where: { clientId, billing: "paid", date: monthRange(month) },
    data: { billing: "invoiced", paidAt: null },
  });

  revalidateBilling(clientId);
  return result.count;
}
