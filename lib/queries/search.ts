import { prisma } from "@/lib/db";

export type SearchKind = "client" | "prospect" | "site";

export interface SearchItem {
  id: string;
  kind: SearchKind;
  label: string;
  /** Deuxième ligne : société, étape du pipeline, catégorie de veille… */
  detail: string | null;
  href: string;
  /** Couleur d'identité du client, quand elle existe. */
  color?: string;
  /** Recherché en plus du libellé (e-mail, tags, société). */
  keywords: string[];
}

/**
 * Index de recherche global de la palette ⌘K.
 *
 * Il est chargé côté serveur avec la mise en page et tient entièrement en
 * mémoire : un freelance a des dizaines de lignes, pas des milliers. Cela évite
 * un aller-retour réseau à chaque frappe — la palette doit répondre à la
 * vitesse du clavier, sinon on retourne à la souris.
 */
export async function getSearchIndex(): Promise<SearchItem[]> {
  const [clients, prospects, sites] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, company: true, email: true, color: true, status: true },
    }),
    prisma.prospect.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, company: true, email: true, stage: true },
    }),
    prisma.watchSite.findMany({
      orderBy: { title: "asc" },
      select: { id: true, title: true, url: true, category: true, tags: true },
    }),
  ]);

  const stageLabels: Record<string, string> = {
    contacted: "Contacté",
    quoted: "Devis envoyé",
    won: "Gagné",
    lost: "Perdu",
  };

  return [
    ...clients.map<SearchItem>((client) => ({
      id: client.id,
      kind: "client",
      label: client.name,
      detail: client.company ?? (client.status === "archived" ? "Archivé" : null),
      href: `/clients/${client.id}`,
      color: client.color,
      keywords: [client.company, client.email].filter((value): value is string => Boolean(value)),
    })),
    ...prospects.map<SearchItem>((prospect) => ({
      id: prospect.id,
      kind: "prospect",
      label: prospect.name,
      detail: prospect.company ?? stageLabels[prospect.stage] ?? null,
      href: "/prospects",
      keywords: [prospect.company, prospect.email, stageLabels[prospect.stage]].filter(
        (value): value is string => Boolean(value),
      ),
    })),
    ...sites.map<SearchItem>((site) => ({
      id: site.id,
      kind: "site",
      label: site.title,
      detail: site.category,
      href: site.url,
      keywords: [site.category, ...site.tags.split(",")]
        .map((value) => value.trim())
        .filter(Boolean),
    })),
  ];
}
