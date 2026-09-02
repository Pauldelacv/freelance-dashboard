"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { isoDateField } from "@/lib/validation";
import { DAY_TYPES } from "@/lib/calculations/revenue";

const fractionField = z.union([z.literal(1), z.literal(0.5)]);
const typeField = z.enum(DAY_TYPES);

const toggleSchema = z.object({
  date: isoDateField,
  clientId: z.string().min(1),
  missionId: z.string().nullable().default(null),
  fraction: fractionField,
  type: typeField,
});

export type ToggleInput = z.input<typeof toggleSchema>;

/** TJM figé à la saisie : mission si elle en porte un, sinon celui du client. */
async function resolveRate(clientId: string, missionId: string | null): Promise<number | null> {
  if (missionId) {
    const mission = await prisma.mission.findUnique({
      where: { id: missionId },
      include: { client: { select: { defaultRate: true } } },
    });
    // Une mission d'un autre client ferait un jour incohérent : la fiche
    // client compterait des jours que sa mission ne connaît pas.
    if (!mission || mission.clientId !== clientId) return null;
    // Au forfait, le CA est porté par la mission elle-même : un jour qui lui est
    // rattaché ne vaut que du temps passé. Lui donner un TJM le facturerait une
    // seconde fois.
    if (mission.billingType === "forfait") return 0;
    return mission.rate ?? mission.client.defaultRate;
  }
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { defaultRate: true },
  });
  return client?.defaultRate ?? null;
}

function revalidateCalendar() {
  revalidatePath("/calendrier");
  revalidatePath("/clients");
  // Les fiches client, toutes : un jour coché change le compte de jours de la
  // mission qui le porte, affiché là et nulle part ailleurs.
  revalidatePath("/clients/[id]", "page");
  revalidatePath("/");
}

/**
 * Coche / décoche un jour pour le client actif.
 * - rien de posé            → on crée la journée
 * - même fraction et type   → on la retire
 * - sinon                   → on met à jour (journée ↔ demi-journée, changement de type)
 */
export async function toggleWorkDayAction(input: ToggleInput): Promise<{ error?: string }> {
  await requireSession();
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) return { error: "Saisie invalide." };
  const { date, clientId, missionId, fraction, type } = parsed.data;

  const existing = await prisma.workDay.findFirst({ where: { date, clientId, missionId } });

  if (!existing) {
    const rate = await resolveRate(clientId, missionId);
    if (rate === null) return { error: "Client ou mission introuvable." };
    await prisma.workDay.create({ data: { date, clientId, missionId, fraction, type, rate } });
  } else if (existing.fraction === fraction && existing.type === type) {
    await prisma.workDay.delete({ where: { id: existing.id } });
  } else {
    await prisma.workDay.update({ where: { id: existing.id }, data: { fraction, type } });
  }

  revalidateCalendar();
  return {};
}

const rangeSchema = z.object({
  dates: z.array(isoDateField).min(1).max(366),
  clientId: z.string().min(1),
  missionId: z.string().nullable().default(null),
  fraction: fractionField,
  type: typeField,
  mode: z.enum(["set", "clear"]),
});

export type RangeInput = z.input<typeof rangeSchema>;

/** Applique (ou efface) une plage de jours d'un coup — sélection au clic-glissé. */
export async function setWorkDayRangeAction(input: RangeInput): Promise<{ error?: string }> {
  await requireSession();
  const parsed = rangeSchema.safeParse(input);
  if (!parsed.success) return { error: "Sélection invalide." };
  const { dates, clientId, missionId, fraction, type, mode } = parsed.data;

  if (mode === "clear") {
    await prisma.workDay.deleteMany({ where: { date: { in: dates }, clientId, missionId } });
    revalidateCalendar();
    return {};
  }

  const rate = await resolveRate(clientId, missionId);
  if (rate === null) return { error: "Client ou mission introuvable." };

  const existing = await prisma.workDay.findMany({
    where: { date: { in: dates }, clientId, missionId },
    select: { id: true, date: true },
  });
  const existingByDate = new Map(existing.map((day) => [day.date, day.id]));

  await prisma.$transaction([
    ...existing.map((day) =>
      prisma.workDay.update({ where: { id: day.id }, data: { fraction, type } }),
    ),
    ...dates
      .filter((date) => !existingByDate.has(date))
      .map((date) =>
        prisma.workDay.create({ data: { date, clientId, missionId, fraction, type, rate } }),
      ),
  ]);

  revalidateCalendar();
  return {};
}

const noteSchema = z.object({
  id: z.string().min(1),
  note: z.string().trim().max(500),
});

export async function setWorkDayNoteAction(input: z.input<typeof noteSchema>) {
  await requireSession();
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return { error: "Note invalide." };
  await prisma.workDay.update({
    where: { id: parsed.data.id },
    data: { note: parsed.data.note || null },
  });
  revalidateCalendar();
  return {};
}
