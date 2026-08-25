import { PageHeader } from "@/components/layout/page-header";
import { ImportDialog } from "@/components/watch/import-dialog";
import { SiteFormDialog } from "@/components/watch/site-form-dialog";
import { WatchList, type WatchSiteItem } from "@/components/watch/watch-list";
import { prisma } from "@/lib/db";

export const metadata = { title: "Veille" };

export default async function VeillePage() {
  const sites = await prisma.watchSite.findMany({
    orderBy: [{ favorite: "desc" }, { title: "asc" }],
  });

  const items: WatchSiteItem[] = sites.map((site) => ({
    id: site.id,
    title: site.title,
    url: site.url,
    category: site.category,
    tags: site.tags,
    frequency: site.frequency,
    notes: site.notes,
    favorite: site.favorite,
    lastVisit: site.lastVisit,
    faviconUrl: site.faviconUrl,
  }));

  const categories = [...new Set(items.map((site) => site.category))].sort((a, b) =>
    a.localeCompare(b),
  );

  return (
    <>
      <PageHeader
        title="Veille"
        description="Annuaire des sites que vous suivez, sans lecteur de flux."
        action={
          <div className="flex items-center gap-2">
            <ImportDialog />
            <SiteFormDialog categories={categories} />
          </div>
        }
      />
      <WatchList sites={items} />
    </>
  );
}
