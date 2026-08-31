"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { revalidateBilling } from "@/lib/billing";
import { todayIso } from "@/lib/dates";
import { BILLING_STATUSES } from "@/lib/calculations/revenue";
import { MISSION_BILLING_TYPES, MISSION_STATUSES } from "@/lib/calculations/missions";
import {
  optionalDaysField,
  optionalIsoDate,
  optionalMoneyField,
  optionalText,
  toFieldErrors,
  type FormState,
} from "@/lib/validation";

/**
 * Missions — régie ou forfait (issue #20).
 *
 * En régie, la mission ne porte qu'un TJM particulier : le CA vient des jours
 * cochés. Au forfait, elle porte le montant convenu *et* son statut de
 * facturation, puisqu'aucun jour ne le fera pour elle. Les deux champs ne
 * cohabitent jamais : ce que le type de facturation n'utilise pas est remis à
 * `null`, pour qu'aucun montant fantôme ne traîne après un changement d'avis.
 */

const missionSchema = z.object({
  clientId: z.string().min(1),
  title: z.string().trim().min(1, "L'intitulé est obligatoire."),
  billingType: z.enum(MISSION_BILLING_TYPES),
  rate: optionalMoneyField,
  forfaitAmount: optionalMoneyField,
  startDate: optionalIsoDate,
  endDate: optionalIsoDate,
  estimatedDays: optionalDaysField,
  status: z.enum(MISSION_STATUSES),
  notes: optionalText,
});

type MissionInput = z.infer<typeof missionSchema>;

function readForm(formData: FormData) {
  return {
    clientId: formData.get("clientId"),
    title: formData.get("title"),
    billingType: formData.get("billingType") ?? "regie",
    rate: formData.get("rate") ?? "",
    forfaitAmount: formData.get("forfaitAmount") ?? "",
    startDate: formData.get("startDate") ?? "",
    endDate: formData.get("endDate") ?? "",
    estimatedDays: formData.get("estimatedDays") ?? "",
    status: formData.get("status") ?? "active",
    notes: formData.get("notes") ?? "",
  };
}

/** Le montant et le TJM s'excluent : un seul des deux survit à l'écriture. */
function toRow(input: MissionInput) {
  const forfait = input.billingType === "forfait";
  return {
    clientId: input.clientId,
    title: input.title,
    billingType: input.billingType,
    rate: forfait ? null : input.rate,
    forfaitAmount: forfait ? input.forfaitAmount : null,
    startDate: input.startDate,
    endDate: input.endDate,
    estimatedDays: input.estimatedDays,
    status: input.status,
    notes: input.notes,
  };
}

function parse(formData: FormData): { data: MissionInput } | { errors: FormState } {
  const parsed = missionSchema.safeParse(readForm(formData));
  if (!parsed.success) return { errors: { fieldErrors: toFieldErrors(parsed.error) } };

  // Un forfait sans montant ne serait ni du CA ni une facture : autant le dire
  // tout de suite plutôt que d'enregistrer une mission muette.
  if (parsed.data.billingType === "forfait" && !parsed.data.forfaitAmount) {
    return { errors: { fieldErrors: { forfaitAmount: "Montant du forfait obligatoire." } } };
  }
  return { data: parsed.data };
}

export async function createMissionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSession();
  const result = parse(formData);
  if ("errors" in result) return result.errors;

  await prisma.mission.create({ data: toRow(result.data) });
  revalidateBilling(result.data.clientId);
  return { ok: true };
}

export async function updateMissionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Mission introuvable." };

  const result = parse(formData);
  if ("errors" in result) return result.errors;

  const row = toRow(result.data);
  // Repasser en régie efface le statut de facturation du forfait : il ne
  // voudrait plus rien dire, et fausserait « à facturer » sur tous les écrans.
  const billing =
    row.billingType === "forfait" ? {} : { billing: "pending", billedAt: null, paidAt: null };

  await prisma.mission.update({ where: { id }, data: { ...row, ...billing } });
  revalidateBilling(result.data.clientId);
  return { ok: true };
}

/** Suppression définitive, refusée si des jours travaillés y sont rattachés. */
export async function deleteMissionAction(id: string): Promise<FormState> {
  await requireSession();
  const mission = await prisma.mission.findUnique({
    where: { id },
    include: { _count: { select: { workDays: true } } },
  });
  if (!mission) return { error: "Mission introuvable." };

  if (mission._count.workDays > 0) {
    const count = mission._count.workDays;
    return {
      error: `Cette mission porte ${count} jour${count > 1 ? "s" : ""} travaillé${count > 1 ? "s" : ""} : passez-la plutôt en « terminée ».`,
    };
  }

  await prisma.mission.delete({ where: { id } });
  revalidateBilling(mission.clientId);
  return { ok: true };
}

const billingSchema = z.object({
  id: z.string().min(1),
  billing: z.enum(BILLING_STATUSES),
});

/**
 * Statut de facturation d'un forfait : à facturer → facturé → encaissé.
 *
 * La date de facture posée à la clôture est conservée au passage à
 * « encaissé » : c'est elle qui date l'encaissement attendu dans le
 * prévisionnel, la réécrire ferait bouger une échéance déjà tenue.
 */
export async function setMissionBillingAction(input: z.input<typeof billingSchema>) {
  await requireSession();
  const parsed = billingSchema.safeParse(input);
  if (!parsed.success) return { error: "Statut invalide." };

  const mission = await prisma.mission.findUnique({ where: { id: parsed.data.id } });
  if (!mission) return { error: "Mission introuvable." };

  const today = todayIso();
  const billing = parsed.data.billing;

  await prisma.mission.update({
    where: { id: mission.id },
    data: {
      billing,
      billedAt: billing === "pending" ? null : (mission.billedAt ?? today),
      paidAt: billing === "paid" ? (mission.paidAt ?? today) : null,
    },
  });

  revalidateBilling(mission.clientId);
  return {};
}
