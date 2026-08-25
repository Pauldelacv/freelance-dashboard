"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { changePassword, requireSession } from "@/lib/auth";
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
