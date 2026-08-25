import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Bascule mois / année.
 *
 * Deux liens et non deux boutons : la vue vit dans l'URL, donc elle se partage,
 * se recharge et se met en favori. Même dessin que les bascules de la barre du
 * calendrier (journée / demi-journée), pour qu'on les lise comme une famille.
 */
export function CalendarViewSwitch({
  view,
  year,
  month,
}: {
  view: "month" | "year";
  year: number;
  month: number;
}) {
  const links = [
    {
      key: "month" as const,
      label: "Mois",
      href: `/calendrier?m=${year}-${String(month).padStart(2, "0")}`,
    },
    { key: "year" as const, label: "Année", href: `/calendrier?vue=annee&a=${year}` },
  ];

  return (
    <div className="border-input flex h-8 overflow-hidden rounded-(--radius-control) border">
      {links.map((link) => (
        <Link
          key={link.key}
          href={link.href}
          aria-current={view === link.key ? "page" : undefined}
          className={cn(
            "flex items-center px-2.5 text-xs transition-colors",
            view === link.key
              ? "bg-primary text-primary-foreground font-medium"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
