"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, signOut } from "@/lib/auth";
import { markPeriodPaid, markPeriodUnpaid } from "@/lib/billing";
import { parseMoney } from "@/lib/money";
import { getSettings, saveSettings } from "@/lib/settings";
import { distributeAnnualGoal, monthsToClear } from "@/lib/calculations/goals";
import { toFieldErrors, type FormState } from "@/lib/validation";

export async function signOutAction(): Promise<void> {
  await signOut();
  redirect("/login");
}

/**
 * Objectifs (modèle `Goal`) — un objectif d'août n'est pas celui de décembre.
 *
 * Les réglages ne portent qu'une valeur *par défaut* : dès qu'une ligne existe
 * pour un mois, elle l'emporte (voir `lib/queries/dashboard.ts`). Vider les deux
 * champs supprime la ligne, et le mois retombe donc sur cette valeur par défaut.
 */
const goalSchema = z.object({
  year: z.coerce.number().int().min(2000, "Année invalide.").max(2100, "Année invalide."),
  month: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : Number(value)))
    .refine(
      (value) => value === null || (Number.isInteger(value) && value >= 1 && value <= 12),
      "Mois invalide.",
    ),
  revenueTarget: z.string().trim(),
  daysTarget: z.string().trim(),
  distribute: z.boolean(),
  months: z.array(z.coerce.number().int().min(1).max(12)),
});

export async function saveGoalAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession();

  const parsed = goalSchema.safeParse({
    year: formData.get("year"),
    month: formData.get("month") ?? "",
    revenueTarget: formData.get("revenueTarget") ?? "",
    daysTarget: formData.get("daysTarget") ?? "",
    distribute: formData.get("distribute") === "on",
    months: formData.getAll("months"),
  });
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };
  const { year, month, distribute, months } = parsed.data;

  const revenueTarget =
    parsed.data.revenueTarget === "" ? null : parseMoney(parsed.data.revenueTarget);
  if (parsed.data.revenueTarget !== "" && revenueTarget === null) {
    return { fieldErrors: { revenueTarget: "Montant invalide." } };
  }

  // Un objectif mensuel se compte en jours du mois, un objectif annuel en jours
  // de l'année : la borne haute n'est pas la même.
  const maxDays = month === null ? 366 : 31;
  const daysTarget =
    parsed.data.daysTarget === "" ? null : Number(parsed.data.daysTarget.replace(",", "."));
  if (daysTarget !== null && (Number.isNaN(daysTarget) || daysTarget < 0 || daysTarget > maxDays)) {
    return { fieldErrors: { daysTarget: "Nombre de jours invalide." } };
  }

  const empty = revenueTarget === null && daysTarget === null;
  if (month === null && distribute) {
    if (empty) return { fieldErrors: { revenueTarget: "Saisissez un objectif à répartir." } };
    if (months.length === 0) return { fieldErrors: { months: "Cochez au moins un mois." } };
  }

  // L'objectif annuel porte `month = null`, que SQLite ne sait pas indexer comme
  // une valeur : `upsert` sur la contrainte (year, month) est donc hors-jeu, et
  // l'on retrouve la ligne par lecture avant de l'écrire.
  const existing = await prisma.goal.findMany({ where: { year } });
  const idOf = (target: number | null) => existing.find((goal) => goal.month === target)?.id;

  const writes = [];

  if (empty) {
    const id = idOf(month);
    if (id) writes.push(prisma.goal.delete({ where: { id } }));
  } else {
    writes.push(saveOne(idOf(month), year, month, { revenueTarget, daysTarget }));
  }

  if (month === null && distribute) {
    for (const part of distributeAnnualGoal({ revenueTarget, daysTarget }, months)) {
      writes.push(
        saveOne(idOf(part.month), year, part.month, {
          revenueTarget: part.revenueTarget,
          daysTarget: part.daysTarget,
        }),
      );
    }

    // Les mois décochés perdent leur objectif : la répartition qu'on vient de
    // poser fait loi. Les y laisser, c'était laisser un objectif mensuel
    // périmé primer sur l'année qu'on venait d'enregistrer (issue #30).
    const previous = existing
      .map((goal) => goal.month)
      .filter((value): value is number => value !== null);
    for (const stale of monthsToClear(previous, months)) {
      const id = idOf(stale);
      if (id) writes.push(prisma.goal.delete({ where: { id } }));
    }
  }

  if (writes.length > 0) await prisma.$transaction(writes);

  revalidatePath("/");
  revalidatePath("/calendrier");
  return { ok: true };
}

function saveOne(
  id: string | undefined,
  year: number,
  month: number | null,
  values: { revenueTarget: number | null; daysTarget: number | null },
) {
  return id
    ? prisma.goal.update({ where: { id }, data: values })
    : prisma.goal.create({ data: { year, month, ...values } });
}

/**
 * Pointage d'un encaissement depuis le tableau de bord.
 *
 * La facture vit dans Indy, qui ne nous dit pas quand elle est payée : le
 * pointage est forcément manuel, et il doit être à portée de clic là où le
 * montant en attente est affiché — sinon « encaissé depuis le 1ᵉʳ janvier »
 * reste à zéro pour toujours.
 */
const periodSchema = z.object({
  clientId: z.string().min(1).nullable(),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Mois attendu au format AAAA-MM."),
});

export async function markInvoicePaidAction(input: z.input<typeof periodSchema>) {
  await requireSession();
  const parsed = periodSchema.safeParse(input);
  if (!parsed.success) return { error: "Période invalide." };

  const count = await markPeriodPaid(parsed.data.clientId, parsed.data.month);
  return { count };
}

/** Annulation d'un pointage : le mois redevient « facturé, non encaissé ». */
export async function markInvoiceUnpaidAction(input: z.input<typeof periodSchema>) {
  await requireSession();
  const parsed = periodSchema.safeParse(input);
  if (!parsed.success) return { error: "Période invalide." };

  const count = await markPeriodUnpaid(parsed.data.clientId, parsed.data.month);
  return { count };
}

/**
 * Déclaration trimestrielle URSSAF marquée faite — ou remise en place
 * (issue #31).
 *
 * Le dashboard ne peut pas savoir si la déclaration a été envoyée : c'est
 * l'utilisateur qui le dit, et la clé du trimestre suffit à s'en souvenir. La
 * liste ne grandit que de quatre entrées par an : on la garde dans les
 * réglages plutôt que d'ouvrir une table pour ça.
 */
const declarationSchema = z.object({
  key: z.string().regex(/^\d{4}-T[1-4]$/, "Trimestre invalide."),
  done: z.boolean(),
});

export async function setDeclarationDoneAction(input: z.input<typeof declarationSchema>) {
  await requireSession();
  const parsed = declarationSchema.safeParse(input);
  if (!parsed.success) return { error: "Trimestre invalide." };
  const { key, done } = parsed.data;

  const settings = await getSettings();
  const current = settings.urssaf.done.filter((entry) => entry !== key);

  await saveSettings({ urssaf: { done: done ? [...current, key] : current } });
  // Pas de `revalidatePath` ici, à dessein : réinvalider le tableau de bord
  // retirerait l'encadré du rendu serveur, donc démonterait le composant — et
  // avec lui le « Annuler » qui vient d'apparaître. L'écran suivant le lira
  // depuis les réglages, où il est bel et bien enregistré.
  return {};
}
