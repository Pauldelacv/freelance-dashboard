import { z } from "zod";
import { parseMoney } from "@/lib/money";

/** Champ monétaire saisi en euros ("550", "550,50") → centimes. */
export const moneyField = z
  .string()
  .trim()
  .min(1, "Montant requis.")
  .transform((value, ctx) => {
    const cents = parseMoney(value);
    if (cents === null || cents < 0) {
      ctx.addIssue({ code: "custom", message: "Montant invalide." });
      return z.NEVER;
    }
    return cents;
  });

/** Champ monétaire facultatif : "" devient `null`, le reste passe en centimes. */
export const optionalMoneyField = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === "") return null;
    const cents = parseMoney(value);
    if (cents === null || cents < 0) {
      ctx.addIssue({ code: "custom", message: "Montant invalide." });
      return z.NEVER;
    }
    return cents;
  });

/** Nombre de jours facultatif, saisi avec virgule ou point. */
export const optionalDaysField = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === "") return null;
    const days = Number(value.replace(",", "."));
    if (Number.isNaN(days) || days < 0 || days > 1000) {
      ctx.addIssue({ code: "custom", message: "Nombre de jours invalide." });
      return z.NEVER;
    }
    return days;
  });

/** Champ texte optionnel : "" devient null. */
export const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value));

/** Date ISO "YYYY-MM-DD". */
export const isoDateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ.");

export const optionalIsoDate = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .refine((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value), "Date invalide.");

/**
 * Mot à saisir pour confirmer un remplacement de toutes les données.
 * Ici et non dans `lib/backup.ts` : le formulaire de restauration est un
 * composant client, et `lib/backup.ts` tire Prisma avec lui.
 */
export const RESTORE_CONFIRMATION = "REMPLACER";

/** Longueur minimale du mot de passe, ici comme dans scripts/hash-password.ts. */
export const MIN_PASSWORD_LENGTH = 8;

/** Changement de mot de passe depuis les réglages. */
export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Saisissez votre mot de passe actuel."),
    newPassword: z
      .string()
      .min(
        MIN_PASSWORD_LENGTH,
        `Mot de passe trop court : ${MIN_PASSWORD_LENGTH} caractères minimum.`,
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "La confirmation ne correspond pas.",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "Le nouveau mot de passe doit être différent de l'actuel.",
    path: ["newPassword"],
  });

/** État renvoyé par toutes les Server Actions de formulaire. */
export interface FormState {
  ok?: boolean;
  error?: string;
  /** Compte rendu de succès, quand « c'est enregistré » ne suffit pas (import). */
  message?: string;
  fieldErrors?: Record<string, string>;
}

export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

export { CLIENT_COLORS } from "@/lib/colors";
