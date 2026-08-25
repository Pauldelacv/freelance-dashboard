"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import {
  CLIENT_COLORS,
  optionalIsoDate,
  optionalText,
  toFieldErrors,
  type FormState,
} from "@/lib/validation";
import { parseMoney } from "@/lib/money";
import { STAGES } from "@/lib/calculations/pipeline";

const prospectSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire."),
  company: optionalText,
  email: z
    .string()
    .trim()
    .email("Adresse e-mail invalide.")
    .or(z.literal(""))
    .transform((v) => v || null),
  phone: optionalText,
  source: optionalText,
  stage: z.enum(STAGES),
  estimatedRate: z.string().trim(),
  estimatedDays: z.string().trim(),
  probability: z.coerce.number().int().min(0).max(100),
  nextAction: optionalText,
  nextActionAt: optionalIsoDate,
  notes: optionalText,
});

function readForm(formData: FormData) {
  return {
    name: formData.get("name"),
    company: formData.get("company") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    source: formData.get("source") ?? "",
    stage: formData.get("stage") ?? "contacted",
    estimatedRate: formData.get("estimatedRate") ?? "",
    estimatedDays: formData.get("estimatedDays") ?? "",
    probability: formData.get("probability") ?? 50,
    nextAction: formData.get("nextAction") ?? "",
    nextActionAt: formData.get("nextActionAt") ?? "",
    notes: formData.get("notes") ?? "",
  };
}

function parseEstimates(data: z.infer<typeof prospectSchema>) {
  const rate = data.estimatedRate === "" ? null : parseMoney(data.estimatedRate);
  if (data.estimatedRate !== "" && rate === null) {
    return { error: { estimatedRate: "TJM invalide." } as Record<string, string> };
  }
  const days = data.estimatedDays === "" ? null : Number(data.estimatedDays.replace(",", "."));
  if (days !== null && (Number.isNaN(days) || days < 0)) {
    return { error: { estimatedDays: "Nombre de jours invalide." } as Record<string, string> };
  }
  return { rate, days };
}

export async function createProspectAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSession();
  const parsed = prospectSchema.safeParse(readForm(formData));
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const estimates = parseEstimates(parsed.data);
  if ("error" in estimates) return { fieldErrors: estimates.error };

  const last = await prisma.prospect.findFirst({
    where: { stage: parsed.data.stage },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  // Les deux estimations sont converties à part : on garde le reste tel quel.
  const { estimatedRate, estimatedDays, ...rest } = parsed.data;
  await prisma.prospect.create({
    data: {
      ...rest,
      estimatedRate: estimates.rate,
      estimatedDays: estimates.days,
      position: (last?.position ?? 0) + 1,
    },
  });

  revalidatePath("/prospects");
  revalidatePath("/");
  return { ok: true };
}

export async function updateProspectAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Prospect introuvable." };

  const parsed = prospectSchema.safeParse(readForm(formData));
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const estimates = parseEstimates(parsed.data);
  if ("error" in estimates) return { fieldErrors: estimates.error };

  // Les deux estimations sont converties à part : on garde le reste tel quel.
  const { estimatedRate, estimatedDays, ...rest } = parsed.data;
  await prisma.prospect.update({
    where: { id },
    data: { ...rest, estimatedRate: estimates.rate, estimatedDays: estimates.days },
  });

  revalidatePath("/prospects");
  revalidatePath("/");
  return { ok: true };
}

const moveSchema = z.object({ id: z.string().min(1), stage: z.enum(STAGES) });

/** Glisser-déposer entre colonnes du kanban. */
export async function moveProspectAction(input: z.input<typeof moveSchema>) {
  await requireSession();
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { error: "Déplacement invalide." };

  const last = await prisma.prospect.findFirst({
    where: { stage: parsed.data.stage },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.prospect.update({
    where: { id: parsed.data.id },
    data: { stage: parsed.data.stage, position: (last?.position ?? 0) + 1 },
  });

  revalidatePath("/prospects");
  revalidatePath("/");
  return {};
}

export async function deleteProspectAction(id: string): Promise<void> {
  await requireSession();
  await prisma.prospect.delete({ where: { id } });
  revalidatePath("/prospects");
  revalidatePath("/");
}

/**
 * Conversion en client : reprend les informations du prospect et garde le lien,
 * pour ne pas ressaisir ce qui a déjà été renseigné.
 */
export async function convertProspectAction(id: string): Promise<FormState> {
  await requireSession();
  const prospect = await prisma.prospect.findUnique({ where: { id } });
  if (!prospect) return { error: "Prospect introuvable." };
  if (prospect.clientId) return { error: "Ce prospect a déjà été converti." };

  const clientCount = await prisma.client.count();
  const client = await prisma.client.create({
    data: {
      name: prospect.name,
      company: prospect.company,
      email: prospect.email,
      phone: prospect.phone,
      defaultRate: prospect.estimatedRate ?? 50000,
      color: CLIENT_COLORS[clientCount % CLIENT_COLORS.length],
      status: "active",
      notes: prospect.notes,
    },
  });

  await prisma.prospect.update({
    where: { id },
    data: { stage: "won", clientId: client.id },
  });

  revalidatePath("/prospects");
  revalidatePath("/clients");
  revalidatePath("/calendrier");
  revalidatePath("/");
  return { ok: true };
}
