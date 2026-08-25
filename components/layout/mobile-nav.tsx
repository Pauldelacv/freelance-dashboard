"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_LINKS } from "./nav-links";

// Sur téléphone (usage PWA) on ne garde que les 5 écrans utilisés au quotidien.
const MOBILE_LINKS = NAV_LINKS.filter((link) =>
  ["/", "/calendrier", "/clients", "/veille", "/reglages"].includes(link.href),
);

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="border-border bg-card/95 sticky bottom-0 z-10 flex border-t backdrop-blur md:hidden">
      {MOBILE_LINKS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2 text-[11px]",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
            {label === "Tableau de bord" ? "Accueil" : label}
          </Link>
        );
      })}
    </nav>
  );
}
