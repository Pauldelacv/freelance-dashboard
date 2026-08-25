"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, LayoutDashboard, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { NAV_LINKS } from "./nav-links";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ indyUrl, signOut }: { indyUrl: string; signOut: () => Promise<void> }) {
  const pathname = usePathname();

  return (
    <aside className="border-border bg-card sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r md:flex">
      <div className="flex items-center gap-2 px-4 py-5">
        <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
          <LayoutDashboard className="size-4" />
        </div>
        <span className="text-sm font-semibold">Freelance</span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        {NAV_LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(pathname, href) ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              isActive(pathname, href)
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="border-border flex flex-col gap-1 border-t p-2">
        {indyUrl ? (
          <a
            href={indyUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors"
          >
            <ExternalLink className="size-4 shrink-0" />
            Facturation Indy
          </a>
        ) : null}
        <div className="flex items-center justify-between px-1">
          <form action={signOut}>
            <Button variant="ghost" size="sm" type="submit" className="text-muted-foreground">
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
