"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useTheme } from "next-themes";
import {
  ArrowUpRight,
  Compass,
  CornerDownLeft,
  ExternalLink,
  Moon,
  Search,
  Sun,
  Target,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { searchItems } from "@/lib/search";
import { Kbd } from "@/components/ui/kbd";
import { NAV_LINKS } from "./nav-links";
import { COMMAND_PALETTE_EVENT } from "./command-palette-events";
import type { SearchItem } from "@/lib/queries/search";

interface Entry {
  key: string;
  label: string;
  detail: string | null;
  keywords: string[];
  group: string;
  icon: LucideIcon;
  color?: string;
  /** Lien externe : ouvert dans un nouvel onglet. */
  external?: boolean;
  run: () => void;
}

const GROUP_ORDER = ["Aller à", "Clients", "Prospects", "Veille", "Affichage"];

const KIND_META: Record<SearchItem["kind"], { group: string; icon: LucideIcon }> = {
  client: { group: "Clients", icon: Users },
  prospect: { group: "Prospects", icon: Target },
  site: { group: "Veille", icon: Compass },
};

export function CommandPalette({ items, indyUrl }: { items: SearchItem[]; indyUrl: string }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // ⌘K / Ctrl+K depuis n'importe où, sauf pendant une saisie : on ne vole pas
  // le raccourci à un champ de texte qui pourrait s'en servir.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      setOpen((previous) => !previous);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Ouverture depuis un bouton (barre latérale, barre du téléphone).
  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener(COMMAND_PALETTE_EVENT, onOpen);
    return () => window.removeEventListener(COMMAND_PALETTE_EVENT, onOpen);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
  }, []);

  const entries = useMemo<Entry[]>(() => {
    const navigation = NAV_LINKS.map<Entry>((link) => ({
      key: `nav:${link.href}`,
      label: link.label,
      detail: null,
      keywords: link.keywords ?? [],
      group: "Aller à",
      icon: link.icon,
      run: () => router.push(link.href),
    }));

    const records = items.map<Entry>((item) => {
      const meta = KIND_META[item.kind];
      return {
        key: `${item.kind}:${item.id}`,
        label: item.label,
        detail: item.detail,
        keywords: item.keywords,
        group: meta.group,
        icon: meta.icon,
        color: item.color,
        external: item.kind === "site",
        run: () => {
          if (item.kind === "site") window.open(item.href, "_blank", "noopener,noreferrer");
          else router.push(item.href);
        },
      };
    });

    const commands: Entry[] = [
      {
        key: "theme",
        label: resolvedTheme === "dark" ? "Passer en thème clair" : "Passer en thème sombre",
        detail: null,
        keywords: ["thème", "sombre", "clair", "dark", "light"],
        group: "Affichage",
        icon: resolvedTheme === "dark" ? Sun : Moon,
        run: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
      },
    ];

    if (indyUrl) {
      commands.push({
        key: "indy",
        label: "Ouvrir la facturation Indy",
        detail: null,
        keywords: ["facture", "comptabilité"],
        group: "Affichage",
        icon: ExternalLink,
        external: true,
        run: () => window.open(indyUrl, "_blank", "noopener,noreferrer"),
      });
    }

    return [...navigation, ...records, ...commands];
  }, [items, indyUrl, resolvedTheme, router, setTheme]);

  const results = useMemo(() => searchItems(entries, query), [entries, query]);

  const groups = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const entry of results) {
      const list = map.get(entry.group);
      if (list) list.push(entry);
      else map.set(entry.group, [entry]);
    }
    return [...map.entries()].sort((a, b) => GROUP_ORDER.indexOf(a[0]) - GROUP_ORDER.indexOf(b[0]));
  }, [results]);

  // L'ordre affiché (groupé) diffère de l'ordre de pertinence : la navigation au
  // clavier doit suivre ce que l'œil voit, pas le classement brut.
  const flat = useMemo(() => groups.flatMap(([, entries]) => entries), [groups]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active, groups]);

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (flat.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (index + 1) % flat.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index - 1 + flat.length) % flat.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(flat.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const entry = flat[active];
      if (entry) {
        close();
        entry.run();
      }
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          aria-label="Recherche et commandes"
          className={cn(
            "fixed top-[12vh] left-1/2 z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2",
            "border-border bg-elevated shadow-overlay overflow-hidden rounded-(--radius-card) border",
          )}
          // La palette est pilotée au clavier depuis son champ : Radix mettrait
          // sinon le focus sur le conteneur.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (event.currentTarget as HTMLElement).querySelector<HTMLInputElement>("input")?.focus();
          }}
        >
          <DialogPrimitive.Title className="sr-only">Recherche et commandes</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Cherchez un client, un prospect ou un site de veille, ou allez directement à une page.
          </DialogPrimitive.Description>

          <div className="border-border flex items-center gap-2.5 border-b px-3.5">
            <Search className="text-muted-foreground size-4 shrink-0" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Client, prospect, site, page…"
              autoComplete="off"
              spellCheck={false}
              aria-label="Rechercher"
              className="placeholder:text-muted-foreground h-11 flex-1 bg-transparent text-sm outline-none"
            />
            <Kbd className="hidden sm:inline-flex">Échap</Kbd>
          </div>

          <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-1.5" role="listbox">
            {flat.length === 0 ? (
              <p className="text-muted-foreground px-2.5 py-8 text-center text-sm">
                Aucun résultat pour «&nbsp;{query.trim()}&nbsp;».
              </p>
            ) : (
              groups.map(([group, groupEntries]) => (
                <div key={group} className="mb-1 last:mb-0">
                  <p className="metric-label px-2.5 pt-2 pb-1">{group}</p>
                  {groupEntries.map((entry) => {
                    const index = flat.indexOf(entry);
                    const isActive = index === active;
                    const Icon = entry.icon;
                    return (
                      <button
                        key={entry.key}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        data-active={isActive}
                        onMouseMove={() => setActive(index)}
                        onClick={() => {
                          close();
                          entry.run();
                        }}
                        className={cn(
                          "relative flex w-full items-center gap-2.5 rounded-(--radius-control) py-1.5 pr-2.5 pl-3 text-left text-sm",
                          isActive ? "bg-muted text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {/* Repère de sélection explicite : sur une surface
                            flottante, un simple changement de fond peut passer
                            inaperçu selon le thème. */}
                        <span
                          aria-hidden
                          className={cn(
                            "absolute top-1/2 left-0.5 h-4 w-0.5 -translate-y-1/2 rounded-full",
                            isActive ? "bg-primary" : "bg-transparent",
                          )}
                        />
                        {entry.color ? (
                          <span
                            aria-hidden
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: entry.color }}
                          />
                        ) : (
                          <Icon className="size-4 shrink-0 opacity-70" />
                        )}
                        <span className="text-foreground truncate">{entry.label}</span>
                        {entry.detail ? (
                          <span className="text-subtle-foreground truncate text-xs">
                            {entry.detail}
                          </span>
                        ) : null}
                        {entry.external ? (
                          <ArrowUpRight className="text-subtle-foreground ml-auto size-3.5 shrink-0" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          <div className="border-border text-subtle-foreground flex items-center gap-3 border-t px-3.5 py-2 text-[11px]">
            <span className="flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              naviguer
            </span>
            <span className="flex items-center gap-1">
              <Kbd>
                <CornerDownLeft className="size-3" />
              </Kbd>
              ouvrir
            </span>
            <span className="tabular ml-auto">
              {flat.length} résultat{flat.length > 1 ? "s" : ""}
            </span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
