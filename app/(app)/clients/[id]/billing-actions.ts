"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { markPeriodPaid, monthRange, revalidateBilling } from "@/lib/billing";
import { todayIso } from "@/lib/dates";
import { BILLING_STATUSES } from "@/lib/calculations/revenue";

const monthSchema = z.object({
  clientId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Mois attendu au format AAAA-MM."),
});

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
      date: monthRange(month),
    },
    data: { billing: "invoiced", billedAt: todayIso() },
  });

  revalidateBilling(clientId);
  return { count: result.count };
}

/** Marque comme encaissé tout ce qui a été facturé sur la période. */
export async function markMonthPaidAction(input: z.input<typeof monthSchema>) {
  await requireSession();
  const parsed = monthSchema.safeParse(input);
  if (!parsed.success) return { error: "Période invalide." };

  return { count: await markPeriodPaid(parsed.data.clientId, parsed.data.month) };
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
      date: monthRange(month),
    },
    data: { billing: "pending", billedAt: null, paidAt: null },
  });

  revalidateBilling(clientId);
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

  revalidateBilling(day.clientId);
  return {};
}
