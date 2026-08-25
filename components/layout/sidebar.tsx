"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, LogOut, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { ThemeToggle } from "@/components/theme-toggle";
import { NAV_SECTIONS, isActive } from "./nav-links";
import { openCommandPalette } from "./command-palette-events";

export function Sidebar({ indyUrl, signOut }: { indyUrl: string; signOut: () => Promise<void> }) {
  const pathname = usePathname();

  return (
    <aside className="border-border bg-card sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r md:flex">
      <div className="flex items-center gap-2 px-3 py-4">
        {/* Monogramme plutôt qu'une icône générique dans un carré coloré : deux
            lettres tenues par une bordure lisent comme une marque, pas comme un
            composant posé là. */}
        <span
          aria-hidden
          className="border-border text-foreground flex size-7 items-center justify-center rounded-md border text-[11px] font-semibold tracking-tight"
        >
          fd
        </span>
        <span className="text-sm font-semibold">Freelance</span>
      </div>

      {/* La recherche est le premier élément de la colonne : c'est le chemin le
          plus court vers n'importe quoi, et sa place l'annonce. */}
      <div className="px-2 pb-2">
        <button
          type="button"
          onClick={openCommandPalette}
          className={cn(
            "border-border bg-background text-muted-foreground hover:text-foreground hover:border-border-strong",
            "flex w-full items-center gap-2 rounded-(--radius-control) border px-2 py-1.5 text-sm transition-colors",
          )}
        >
          <Search className="size-3.5 shrink-0" />
          Rechercher
          <Kbd className="ml-auto">⌘K</Kbd>
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-2 py-1">
        {NAV_SECTIONS.map((section, index) => (
          <div key={section.title ?? `section-${index}`} className="flex flex-col gap-0.5">
            {section.title ? <p className="metric-label px-2 pb-1">{section.title}</p> : null}
            {section.links.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-2.5 rounded-(--radius-control) px-2 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-muted text-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  {/* Repère actif à gauche : un filet vertical suffit et laisse
                      le fond neutre, là où une pastille pleine colorée écrase
                      tout le reste de la colonne. */}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full",
                      active ? "bg-primary" : "bg-transparent",
                    )}
                  />
                  <Icon className={cn("size-4 shrink-0", active ? "" : "opacity-80")} />
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-border flex flex-col gap-1 border-t p-2">
        {indyUrl ? (
          <a
            href={indyUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-2.5 rounded-(--radius-control) px-2 py-1.5 text-sm transition-colors"
          >
            <ExternalLink className="size-4 shrink-0 opacity-80" />
            Facturation Indy
          </a>
        ) : null}
        <div className="flex items-center gap-1">
          <form action={signOut} className="flex-1">
            <Button variant="ghost" size="sm" type="submit" className="w-full justify-start px-2">
              <LogOut />
              Déconnexion
            </Button>
          </form>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
