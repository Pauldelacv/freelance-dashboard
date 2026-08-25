"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { todayIso } from "@/lib/dates";
import { fetchSiteMetadata, normalizeTags, normalizeUrl } from "@/lib/watch-metadata";
import { optionalText, toFieldErrors, type FormState } from "@/lib/validation";

const siteSchema = z.object({
  url: z.string().trim().min(1, "URL requise."),
  title: z.string().trim().default(""),
  category: z.string().trim().default(""),
  tags: z.string().trim().default(""),
  frequency: optionalText,
  notes: optionalText,
});

/**
 * Ajout rapide : on colle une URL, le titre et le favicon sont récupérés.
 * Un titre saisi à la main n'est jamais écrasé.
 */
export async function createSiteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const parsed = siteSchema.safeParse({
    url: formData.get("url"),
    title: formData.get("title") ?? "",
    category: formData.get("category") ?? "",
    tags: formData.get("tags") ?? "",
    frequency: formData.get("frequency") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const url = normalizeUrl(parsed.data.url);
  if (!url) return { fieldErrors: { url: "URL invalide." } };

  const existing = await prisma.watchSite.findFirst({ where: { url } });
  if (existing) return { fieldErrors: { url: "Ce site est déjà dans la liste." } };

  const metadata = await fetchSiteMetadata(url);

  await prisma.watchSite.create({
    data: {
      url,
      title: parsed.data.title || metadata.title,
      faviconUrl: metadata.faviconUrl,
      category: parsed.data.category || "Divers",
      tags: normalizeTags(parsed.data.tags),
      frequency: parsed.data.frequency,
      notes: parsed.data.notes,
    },
  });

  revalidatePath("/veille");
  return { ok: true };
}

export async function updateSiteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Site introuvable." };

  const parsed = siteSchema.safeParse({
    url: formData.get("url"),
    title: formData.get("title") ?? "",
    category: formData.get("category") ?? "",
    tags: formData.get("tags") ?? "",
    frequency: formData.get("frequency") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const url = normalizeUrl(parsed.data.url);
  if (!url) return { fieldErrors: { url: "URL invalide." } };

  await prisma.watchSite.update({
    where: { id },
    data: {
      url,
      title: parsed.data.title || url,
      category: parsed.data.category || "Divers",
      tags: normalizeTags(parsed.data.tags),
      frequency: parsed.data.frequency,
      notes: parsed.data.notes,
    },
  });

  revalidatePath("/veille");
  return { ok: true };
}

export async function toggleFavoriteAction(id: string): Promise<void> {
  await requireSession();
  const site = await prisma.watchSite.findUnique({ where: { id }, select: { favorite: true } });
  if (!site) return;
  await prisma.watchSite.update({ where: { id }, data: { favorite: !site.favorite } });
  revalidatePath("/veille");
}

/** Repère les sites délaissés : on note la date de dernière ouverture. */
export async function markVisitAction(id: string): Promise<void> {
  await requireSession();
  await prisma.watchSite.update({ where: { id }, data: { lastVisit: todayIso() } });
  revalidatePath("/veille");
}

export async function deleteSiteAction(id: string): Promise<void> {
  await requireSession();
  await prisma.watchSite.delete({ where: { id } });
  revalidatePath("/veille");
}

/** Rafraîchit titre et favicon depuis la page distante. */
export async function refreshMetadataAction(id: string): Promise<void> {
  await requireSession();
  const site = await prisma.watchSite.findUnique({ where: { id } });
  if (!site) return;
  const metadata = await fetchSiteMetadata(site.url);
  await prisma.watchSite.update({
    where: { id },
    data: { title: metadata.title || site.title, faviconUrl: metadata.faviconUrl },
  });
  revalidatePath("/veille");
}

const importSchema = z.array(
  z.object({
    title: z.string().trim().min(1),
    url: z.string().trim().min(1),
    category: z.string().trim().optional(),
    tags: z.string().trim().optional(),
    frequency: z.string().trim().nullable().optional(),
    favorite: z.boolean().optional(),
    notes: z.string().trim().nullable().optional(),
  }),
);

/** Import JSON (export de cette application) ou OPML (lecteur RSS existant). */
export async function importSitesAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireSession();
  const raw = String(formData.get("payload") ?? "").trim();
  if (!raw) return { error: "Collez un export JSON ou OPML." };

  let entries: z.infer<typeof importSchema>;

  if (raw.startsWith("<")) {
    entries = parseOpml(raw);
  } else {
    try {
      const parsed = importSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) return { error: "JSON reconnu mais mal formé." };
      entries = parsed.data;
    } catch {
      return { error: "Contenu illisible : ni JSON, ni OPML." };
    }
  }

  if (entries.length === 0) return { error: "Aucun site trouvé dans cet export." };

  let imported = 0;
  for (const entry of entries) {
    const url = normalizeUrl(entry.url);
    if (!url) continue;
    const existing = await prisma.watchSite.findFirst({ where: { url } });
    if (existing) continue;
    await prisma.watchSite.create({
      data: {
        url,
        title: entry.title,
        category: entry.category || "Divers",
        tags: normalizeTags(entry.tags ?? ""),
        frequency: entry.frequency ?? null,
        favorite: entry.favorite ?? false,
        notes: entry.notes ?? null,
      },
    });
    imported += 1;
  }

  revalidatePath("/veille");
  return { ok: true, error: imported === 0 ? "Tous ces sites étaient déjà présents." : undefined };
}

/** OPML minimal : on ne lit que les <outline> porteurs d'une URL. */
function parseOpml(xml: string): z.infer<typeof importSchema> {
  const entries: z.infer<typeof importSchema> = [];
  for (const [tag] of xml.matchAll(/<outline\b[^>]*>/gi)) {
    const url =
      tag.match(/htmlUrl\s*=\s*"([^"]+)"/i)?.[1] ?? tag.match(/xmlUrl\s*=\s*"([^"]+)"/i)?.[1];
    if (!url) continue;
    const title =
      tag.match(/\btitle\s*=\s*"([^"]+)"/i)?.[1] ??
      tag.match(/\btext\s*=\s*"([^"]+)"/i)?.[1] ??
      url;
    entries.push({ title, url, category: "Import OPML" });
  }
  return entries;
}
