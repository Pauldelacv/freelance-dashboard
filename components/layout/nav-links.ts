import {
  CalendarDays,
  Compass,
  Cog,
  LayoutDashboard,
  LineChart,
  Target,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Libellé court pour la barre basse du téléphone. */
  shortLabel?: string;
  /** Mots-clés supplémentaires pour la recherche ⌘K. */
  keywords?: string[];
}

export interface NavSection {
  /** `null` = pas d'intitulé : la première section n'en a pas besoin. */
  title: string | null;
  links: NavLink[];
}

/**
 * La navigation est groupée par *rythme d'usage*, pas par thème :
 * ce qu'on ouvre tous les jours, ce qu'on pilote au mois, ce qu'on consulte.
 * Sur huit entrées, trois groupes courts se balayent plus vite qu'une liste
 * plate — et la position de chaque lien devient mémorisable.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    title: null,
    links: [
      {
        href: "/",
        label: "Tableau de bord",
        shortLabel: "Accueil",
        icon: LayoutDashboard,
        keywords: ["accueil", "kpi", "résumé"],
      },
      {
        href: "/calendrier",
        label: "Calendrier",
        icon: CalendarDays,
        keywords: ["jours", "cocher", "planning"],
      },
    ],
  },
  {
    title: "Activité",
    links: [
      { href: "/clients", label: "Clients", icon: Users, keywords: ["tjm", "société"] },
      {
        href: "/prospects",
        label: "Prospects",
        icon: Target,
        keywords: ["pipeline", "devis", "relance"],
      },
      {
        href: "/tresorerie",
        label: "Trésorerie",
        icon: Wallet,
        keywords: ["encaissements", "prévisionnel", "cash"],
      },
      {
        href: "/simulateur",
        label: "Simulateur TJM",
        shortLabel: "Simulateur",
        icon: LineChart,
        keywords: ["tarif", "net", "charges"],
      },
    ],
  },
  {
    title: "Ressources",
    links: [
      { href: "/veille", label: "Veille", icon: Compass, keywords: ["sites", "liens", "annuaire"] },
      {
        href: "/reglages",
        label: "Réglages",
        shortLabel: "Réglages",
        icon: Cog,
        keywords: ["paramètres", "objectifs", "export", "sauvegarde"],
      },
    ],
  },
];

/** Liste à plat — recherche ⌘K, barre basse du téléphone. */
export const NAV_LINKS: NavLink[] = NAV_SECTIONS.flatMap((section) => section.links);

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
