"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import {
  CLIENT_COLORS,
  moneyField,
  optionalText,
  toFieldErrors,
  type FormState,
} from "@/lib/validation";

const clientSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire."),
  company: optionalText,
  email: z
    .string()
    .trim()
    .email("Adresse e-mail invalide.")
    .or(z.literal(""))
    .transform((v) => v || null),
  phone: optionalText,
  defaultRate: moneyField,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide."),
  paymentTerms: z.coerce.number().int().min(0, "Délai invalide.").max(180, "Délai trop long."),
  status: z.enum(["active", "prospect", "archived"]),
  notes: optionalText,
});

function readForm(formData: FormData) {
  return {
    name: formData.get("name"),
    company: formData.get("company") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    defaultRate: formData.get("defaultRate"),
    color: formData.get("color") ?? CLIENT_COLORS[0],
    paymentTerms: formData.get("paymentTerms") ?? 30,
    status: formData.get("status") ?? "active",
    notes: formData.get("notes") ?? "",
  };
}

export async function createClientAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const parsed = clientSchema.safeParse(readForm(formData));
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  await prisma.client.create({ data: parsed.data });
  revalidatePath("/clients");
  revalidatePath("/calendrier");
  revalidatePath("/");
  return { ok: true };
}

export async function updateClientAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Client introuvable." };

  const parsed = clientSchema.safeParse(readForm(formData));
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  // Le TJM des jours déjà saisis n'est jamais réécrit : il est figé à la saisie.
  await prisma.client.update({ where: { id }, data: parsed.data });
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  revalidatePath("/calendrier");
  revalidatePath("/");
  return { ok: true };
}

export async function setClientStatusAction(id: string, status: string): Promise<void> {
  await requireSession();
  const allowed = ["active", "prospect", "archived"];
  if (!allowed.includes(status)) return;
  await prisma.client.update({ where: { id }, data: { status } });
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  revalidatePath("/calendrier");
}

/** Suppression définitive, refusée si des jours travaillés y sont rattachés. */
export async function deleteClientAction(id: string): Promise<FormState> {
  await requireSession();
  const days = await prisma.workDay.count({ where: { clientId: id } });
  if (days > 0) {
    return {
      error: `Ce client a ${days} jour${days > 1 ? "s" : ""} travaillé${days > 1 ? "s" : ""} : archivez-le plutôt que de le supprimer.`,
    };
  }
  await prisma.client.delete({ where: { id } });
  revalidatePath("/clients");
  revalidatePath("/calendrier");
  return { ok: true };
}
