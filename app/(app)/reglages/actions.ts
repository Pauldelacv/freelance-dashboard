"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { changePassword, requireSession } from "@/lib/auth";
import { RESTORE_CONFIRMATION, parseBackup, restoreBackup, summarizeCounts } from "@/lib/backup";
import { saveSettings } from "@/lib/settings";
import { parseMoney } from "@/lib/money";
import { passwordChangeSchema, toFieldErrors, type FormState } from "@/lib/validation";

const formSchema = z.object({
  indyUrl: z
    .string()
    .trim()
    .refine((value) => value === "" || /^https?:\/\/.+/.test(value), "URL invalide (https://…).")
    .default(""),
  chargeRate: z.coerce
    .number()
    .min(0, "Taux invalide.")
    .max(90, "Taux invalide.")
    .transform((value) => Math.round(value * 10) / 1000),
  vat: z.coerce.boolean().default(false),
  vatRate: z.coerce
    .number()
    .min(0)
    .max(30)
    .transform((value) => Math.round(value * 10) / 1000),
  monthlyRevenue: z.string().trim(),
  monthlyDays: z.string().trim(),
  defaultFraction: z.enum(["1", "0.5"]),
  expenses: z.coerce.boolean().default(false),
});

export async function saveSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession();

  const parsed = formSchema.safeParse({
    indyUrl: formData.get("indyUrl") ?? "",
    chargeRate: formData.get("chargeRate") ?? 26.1,
    vat: formData.get("vat") === "on",
    vatRate: formData.get("vatRate") ?? 20,
    monthlyRevenue: formData.get("monthlyRevenue") ?? "",
    monthlyDays: formData.get("monthlyDays") ?? "",
    defaultFraction: formData.get("defaultFraction") ?? "1",
    expenses: formData.get("expenses") === "on",
  });

  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };
  const data = parsed.data;

  const monthlyRevenue = data.monthlyRevenue === "" ? null : parseMoney(data.monthlyRevenue);
  if (data.monthlyRevenue !== "" && monthlyRevenue === null) {
    return { fieldErrors: { monthlyRevenue: "Montant invalide." } };
  }

  const monthlyDays = data.monthlyDays === "" ? null : Number(data.monthlyDays.replace(",", "."));
  if (monthlyDays !== null && (Number.isNaN(monthlyDays) || monthlyDays < 0 || monthlyDays > 31)) {
    return { fieldErrors: { monthlyDays: "Nombre de jours invalide." } };
  }

  await saveSettings({
    indyUrl: data.indyUrl,
    tax: { chargeRate: data.chargeRate, vat: data.vat, vatRate: data.vatRate },
    modules: { expenses: data.expenses },
    goals: { monthlyRevenue, monthlyDays },
    workday: { defaultFraction: data.defaultFraction === "0.5" ? 0.5 : 1 },
  });

  revalidatePath("/reglages");
  revalidatePath("/");
  revalidatePath("/calendrier");
  return { ok: true };
}

/**
 * Changement du mot de passe de connexion (issue #12).
 *
 * Le nouveau hash est rangé en base : APP_PASSWORD_HASH n'est plus que le mot
 * de passe d'amorçage. Toutes les autres sessions ouvertes tombent.
 */
export async function changePasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSession();

  const parsed = passwordChangeSchema.safeParse({
    currentPassword: formData.get("currentPassword") ?? "",
    newPassword: formData.get("newPassword") ?? "",
    confirmPassword: formData.get("confirmPassword") ?? "",
  });
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const result = await changePassword(parsed.data.currentPassword, parsed.data.newPassword);
  if (!result.ok) {
    const message = result.error ?? "Le changement de mot de passe a échoué.";
    return result.field ? { fieldErrors: { [result.field]: message } } : { error: message };
  }
  return { ok: true };
}

/** Un fichier de sauvegarde plus gros que ça n'est plus une sauvegarde de ce dashboard. */
const MAX_BACKUP_BYTES = 32 * 1024 * 1024;

/**
 * Restauration depuis une sauvegarde JSON (issue #7).
 *
 * Remplacement complet, jamais fusion : la question « que faire des lignes qui
 * existent des deux côtés ? » n'a pas de bonne réponse générale, alors que
 * « la base devient celle du fichier » se vérifie. D'où la confirmation écrite,
 * et le rappel de télécharger une sauvegarde avant d'écraser.
 */
export async function restoreBackupAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSession();

  const confirmation = String(formData.get("confirmation") ?? "")
    .trim()
    .toUpperCase();
  if (confirmation !== RESTORE_CONFIRMATION) {
    return {
      fieldErrors: {
        confirmation: `Saisissez « ${RESTORE_CONFIRMATION} » pour confirmer le remplacement.`,
      },
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { fieldErrors: { file: "Choisissez un fichier de sauvegarde." } };
  }
  if (file.size > MAX_BACKUP_BYTES) {
    return { fieldErrors: { file: "Fichier trop volumineux pour être une sauvegarde." } };
  }

  const parsed = parseBackup(await file.text());
  if (!parsed.ok) return { error: parsed.error };

  const counts = await restoreBackup(prisma, parsed.data);

  // Tout a changé : on invalide sous la racine plutôt que page par page.
  revalidatePath("/", "layout");
  return { ok: true, message: `Données remplacées — ${summarizeCounts(counts)}.` };
}
