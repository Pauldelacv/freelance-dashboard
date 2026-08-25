"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { todayIso } from "@/lib/dates";
import { BILLING_STATUSES } from "@/lib/calculations/revenue";

const monthSchema = z.object({
  clientId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Mois attendu au format AAAA-MM."),
});

function revalidateClient(clientId: string) {
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  revalidatePath("/calendrier");
  revalidatePath("/");
}

/**
 * Clôture d'un mois : tous les jours « à facturer » de la période passent à
 * « facturé », avec la date du jour comme date de facture Indy.
 * C'est ce qui alimente ensuite le prévisionnel de trésorerie.
 */
export async function closeMonthAction(input: z.input<typeof monthSchema>) {
  await requireSession();
  const parsed = monthSchema.safeParse(input);
  if (!parsed.success) return { error: "Période invalide." };
  const { clientId, month } = parsed.data;

  const result = await prisma.workDay.updateMany({
    where: {
      clientId,
      type: "billable",
      billing: "pending",
      date: { gte: `${month}-01`, lte: `${month}-31` },
    },
    data: { billing: "invoiced", billedAt: todayIso() },
  });

  revalidateClient(clientId);
  return { count: result.count };
}

/** Marque comme encaissé tout ce qui a été facturé sur la période. */
export async function markMonthPaidAction(input: z.input<typeof monthSchema>) {
  await requireSession();
  const parsed = monthSchema.safeParse(input);
  if (!parsed.success) return { error: "Période invalide." };
  const { clientId, month } = parsed.data;

  const result = await prisma.workDay.updateMany({
    where: {
      clientId,
      billing: "invoiced",
      date: { gte: `${month}-01`, lte: `${month}-31` },
    },
    data: { billing: "paid", paidAt: todayIso() },
  });

  revalidateClient(clientId);
  return { count: result.count };
}

/** Annule une clôture : le mois repasse « à facturer ». */
export async function reopenMonthAction(input: z.input<typeof monthSchema>) {
  await requireSession();
  const parsed = monthSchema.safeParse(input);
  if (!parsed.success) return { error: "Période invalide." };
  const { clientId, month } = parsed.data;

  const result = await prisma.workDay.updateMany({
    where: {
      clientId,
      billing: { in: ["invoiced", "paid"] },
      date: { gte: `${month}-01`, lte: `${month}-31` },
    },
    data: { billing: "pending", billedAt: null, paidAt: null },
  });

  revalidateClient(clientId);
  return { count: result.count };
}

const daySchema = z.object({
  id: z.string().min(1),
  billing: z.enum(BILLING_STATUSES),
});

/** Statut d'un jour isolé, depuis le tableau des jours. */
export async function setDayBillingAction(input: z.input<typeof daySchema>) {
  await requireSession();
  const parsed = daySchema.safeParse(input);
  if (!parsed.success) return { error: "Statut invalide." };

  const today = todayIso();
  const day = await prisma.workDay.update({
    where: { id: parsed.data.id },
    data: {
      billing: parsed.data.billing,
      billedAt: parsed.data.billing === "pending" ? null : today,
      paidAt: parsed.data.billing === "paid" ? today : null,
    },
  });

  if (day.clientId) revalidateClient(day.clientId);
  return {};
}
