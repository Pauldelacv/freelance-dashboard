"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_LINKS, isActive } from "./nav-links";
import { openCommandPalette } from "./command-palette-events";

// Sur téléphone (usage PWA) on ne garde que les écrans utilisés au quotidien ;
// la recherche remplace les trois autres, elle y mène en deux gestes.
const MOBILE_LINKS = NAV_LINKS.filter((link) =>
  ["/", "/calendrier", "/clients", "/veille"].includes(link.href),
);

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "border-border bg-card/90 sticky bottom-0 z-10 flex border-t backdrop-blur md:hidden",
        // Encoche et barre d'accueil iOS : sans cela le dernier onglet passe
        // sous la barre système en mode application installée.
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      {MOBILE_LINKS.map(({ href, label, shortLabel, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2 text-[11px]",
              active ? "text-foreground font-medium" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
            {shortLabel ?? label}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={openCommandPalette}
        className="text-muted-foreground flex flex-1 flex-col items-center gap-1 py-2 text-[11px]"
      >
        <Search className="size-5" />
        Rechercher
      </button>
    </nav>
  );
}
