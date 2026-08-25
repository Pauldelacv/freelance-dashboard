"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Download,
  ExternalLink,
  LayoutGrid,
  List,
  Pencil,
  RefreshCw,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { parseTags } from "@/lib/watch-metadata";
import { SiteFormDialog, type SiteFormValues } from "@/components/watch/site-form-dialog";
import {
  deleteSiteAction,
  markVisitAction,
  refreshMetadataAction,
  toggleFavoriteAction,
} from "@/app/(app)/veille/actions";

export interface WatchSiteItem extends SiteFormValues {
  favorite: boolean;
  lastVisit: string | null;
  faviconUrl: string | null;
}

const FREQUENCY_LABELS: Record<string, string> = {
  quotidien: "Quotidienne",
  hebdo: "Hebdomadaire",
  mensuel: "Mensuelle",
};

export function WatchList({ sites }: { sites: WatchSiteItem[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [tag, setTag] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [dense, setDense] = useState(true);
  const [pending, startTransition] = useTransition();

  const categories = useMemo(
    () => [...new Set(sites.map((site) => site.category))].sort((a, b) => a.localeCompare(b)),
    [sites],
  );

  const tags = useMemo(
    () =>
      [...new Set(sites.flatMap((site) => parseTags(site.tags)))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [sites],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sites.filter((site) => {
      if (favoritesOnly && !site.favorite) return false;
      if (category && site.category !== category) return false;
      if (tag && !parseTags(site.tags).includes(tag)) return false;
      if (!needle) return true;
      return (
        site.title.toLowerCase().includes(needle) ||
        site.url.toLowerCase().includes(needle) ||
        site.tags.toLowerCase().includes(needle) ||
        site.category.toLowerCase().includes(needle)
      );
    });
  }, [category, favoritesOnly, query, sites, tag]);

  function exportJson() {
    const payload = JSON.stringify(
      sites.map(({ title, url, category: cat, tags: siteTags, frequency, favorite, notes }) => ({
        title,
        url,
        category: cat,
        tags: siteTags,
        frequency,
        favorite,
        notes,
      })),
      null,
      2,
    );
    const blob = new Blob([payload], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `veille-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-52 flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un site, un tag…"
            className="pl-8"
            aria-label="Rechercher"
          />
        </div>

        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          aria-label="Catégorie"
          className="border-input bg-card h-9 rounded-lg border px-3 text-sm shadow-xs"
        >
          <option value="">Toutes les catégories</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <Button
          variant={favoritesOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setFavoritesOnly((value) => !value)}
        >
          <Star className={favoritesOnly ? "fill-current" : ""} />
          Favoris
        </Button>

        <Button
          variant="ghost"
          size="icon"
          aria-label={dense ? "Vue cartes" : "Vue liste"}
          onClick={() => setDense((value) => !value)}
        >
          {dense ? <LayoutGrid /> : <List />}
        </Button>

        <Button variant="ghost" size="sm" onClick={exportJson}>
          <Download />
          Exporter
        </Button>
      </Card>

      {tags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTag((current) => (current === item ? "" : item))}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs transition-colors",
                tag === item
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              #{item}
            </button>
          ))}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <Card className="text-muted-foreground p-8 text-sm">
          {sites.length === 0
            ? "Aucun site pour l'instant. Collez une URL pour commencer votre annuaire."
            : "Aucun site ne correspond à ces filtres."}
        </Card>
      ) : (
        <div
          className={cn(
            dense ? "flex flex-col gap-1.5" : "grid gap-3 md:grid-cols-2 xl:grid-cols-3",
          )}
        >
          {filtered.map((site) => (
            <Card
              key={site.id}
              className={cn(
                "flex gap-3 p-3",
                dense ? "items-center" : "flex-col items-start justify-between",
              )}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                {/* Favicon distant : <img> volontaire, pas d'optimisation Next
                    pour un domaine arbitraire. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={site.faviconUrl ?? ""}
                  alt=""
                  width={16}
                  height={16}
                  className="size-4 shrink-0 rounded-sm"
                  onError={(event) => {
                    event.currentTarget.style.visibility = "hidden";
                  }}
                />
                <div className="min-w-0">
                  <a
                    href={site.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    onClick={() =>
                      startTransition(async () => {
                        await markVisitAction(site.id);
                      })
                    }
                    className="flex items-center gap-1 truncate text-sm font-medium hover:underline"
                  >
                    <span className="truncate">{site.title}</span>
                    <ExternalLink className="text-muted-foreground size-3 shrink-0" />
                  </a>
                  <p className="text-muted-foreground truncate text-xs">
                    {site.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                    {site.lastVisit ? ` · vu le ${site.lastVisit}` : " · jamais ouvert"}
                  </p>
                </div>
              </div>

              <div
                className={cn("flex items-center gap-1.5", dense ? "" : "w-full justify-between")}
              >
                <div className="flex flex-wrap items-center gap-1">
                  <Badge variant="outline">{site.category}</Badge>
                  {site.frequency ? (
                    <Badge variant="muted">{FREQUENCY_LABELS[site.frequency]}</Badge>
                  ) : null}
                  {parseTags(site.tags).map((item) => (
                    <span key={item} className="text-muted-foreground text-xs">
                      #{item}
                    </span>
                  ))}
                </div>

                <div className="flex items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={site.favorite ? "Retirer des favoris" : "Mettre en favori"}
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await toggleFavoriteAction(site.id);
                      })
                    }
                  >
                    <Star className={site.favorite ? "fill-warning text-warning" : ""} />
                  </Button>
                  <SiteFormDialog
                    site={site}
                    categories={categories}
                    trigger={
                      <Button variant="ghost" size="icon" aria-label="Modifier">
                        <Pencil />
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Rafraîchir le titre et le favicon"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await refreshMetadataAction(site.id);
                      })
                    }
                  >
                    <RefreshCw />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Supprimer"
                    disabled={pending}
                    onClick={() => {
                      if (!window.confirm(`Supprimer « ${site.title} » ?`)) return;
                      startTransition(async () => {
                        await deleteSiteAction(site.id);
                      });
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <p className="text-muted-foreground text-xs">
        {filtered.length} site{filtered.length > 1 ? "s" : ""} affiché
        {filtered.length > 1 ? "s" : ""} sur {sites.length}.
      </p>
    </div>
  );
}
