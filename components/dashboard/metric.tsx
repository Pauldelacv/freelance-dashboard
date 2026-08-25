import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Couple libellé / valeur. Le libellé se distingue par sa *forme* (petit,
 * capitales, espacé) et pas seulement par sa couleur : sur un fond clair comme
 * sur un fond sombre, la hiérarchie tient sans dépendre du contraste.
 */
export function Metric({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="metric-label">{label}</p>
      <p className="tabular mt-1 text-sm font-medium">{value}</p>
      {hint ? <p className="text-subtle-foreground mt-0.5 truncate text-xs">{hint}</p> : null}
    </div>
  );
}

/**
 * Bande de métriques secondaires, séparées par des filets verticaux.
 *
 * Cinq mesures parallèles sont plus lisibles côte à côte dans un seul objet que
 * réparties en cinq cartes : la carte suggère que chaque nombre est un sujet à
 * part entière, ce qu'aucun de ceux-là n'est.
 */
export function MetricRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "divide-border border-border grid grid-cols-2 gap-px border-t sm:grid-cols-3 lg:grid-cols-5",
        "[&>*]:px-4 [&>*]:py-3",
        // Les filets verticaux ne doivent apparaître qu'entre colonnes d'une
        // même ligne : `divide-x` traverserait les retours à la ligne.
        "divide-x-0 sm:divide-x",
        className,
      )}
    >
      {children}
    </div>
  );
}
