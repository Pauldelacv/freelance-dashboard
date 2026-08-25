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

/** État renvoyé par toutes les Server Actions de formulaire. */
export interface FormState {
  ok?: boolean;
  error?: string;
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
