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
}

export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/calendrier", label: "Calendrier", icon: CalendarDays },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/prospects", label: "Prospects", icon: Target },
  { href: "/tresorerie", label: "Trésorerie", icon: Wallet },
  { href: "/simulateur", label: "Simulateur TJM", icon: LineChart },
  { href: "/veille", label: "Veille", icon: Compass },
  { href: "/reglages", label: "Réglages", icon: Cog },
];
