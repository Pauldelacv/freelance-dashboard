import { formatMoney, formatMoneyShort } from "@/lib/money";
import { cn } from "@/lib/utils";

export interface RevenuePoint {
  key: string;
  label: string;
  revenue: number;
}

/**
 * CA des douze derniers mois.
 *
 * Rendu côté serveur : ce graphique n'a besoin d'aucune interaction, on évite
 * d'embarquer Recharts (réservé à la trésorerie, qui a des séries commutables).
 *
 * Trois choix qui comptent quand l'historique est encore court — le cas d'une
 * base neuve, où un seul mois porte des données :
 *
 * - une **ligne de moyenne** en pointillés, sinon un mois isolé n'a rien à quoi
 *   se comparer et la barre unique ne dit rien ;
 * - une **ligne de base continue** qui porte le zéro, pour qu'un mois sans CA
 *   se lise comme un creux et non comme une donnée manquante ;
 * - le **mois en cours contrasté**, les autres en gris : c'est lui qu'on vient
 *   lire, les onze autres sont son contexte.
 */
export function RevenueBars({ points, className }: { points: RevenuePoint[]; className?: string }) {
  const withRevenue = points.filter((point) => point.revenue > 0);
  const peak = Math.max(...points.map((point) => point.revenue), 1);
  // Un peu d'air au-dessus de la plus haute barre : collée au bord, elle donne
  // l'impression d'être tronquée, et le repère de moyenne n'aurait pas la place
  // de porter son étiquette.
  const max = peak * 1.18;
  // La moyenne d'un seul mois est ce mois-là : la tracer n'apprend rien et
  // superpose une ligne à la seule barre du graphique.
  const average =
    withRevenue.length >= 2
      ? withRevenue.reduce((sum, point) => sum + point.revenue, 0) / withRevenue.length
      : 0;
  const averageRatio = average / max;
  const currentKey = points.at(-1)?.key;

  return (
    <figure className={cn("flex flex-col gap-2", className)}>
      {/* Ligne de base continue : c'est elle qui matérialise le zéro. Les mois
          sans CA n'ont donc *pas* de barre — un moignon de deux pixels par mois
          vide donnait une rangée de tirets qu'on lisait comme un axe brisé. */}
      <div className="border-border relative flex h-32 items-end gap-1 border-b">
        {/* Repère de moyenne. Tracé sous les barres pour ne pas les barrer. */}
        {average > 0 ? (
          <div
            aria-hidden
            className="border-border-strong pointer-events-none absolute inset-x-0 border-t border-dashed"
            style={{ bottom: `${averageRatio * 100}%` }}
          >
            <span className="text-subtle-foreground absolute -top-4 right-0 text-[10px] whitespace-nowrap">
              moy. {formatMoneyShort(average)}
            </span>
          </div>
        ) : null}

        {points.map((point) => {
          const isCurrent = point.key === currentKey;
          const ratio = point.revenue / max;
          return (
            <div
              key={point.key}
              className="relative flex h-full flex-1 items-end"
              title={`${point.label} : ${formatMoney(point.revenue)}`}
            >
              {point.revenue > 0 ? (
                <div
                  className={cn(
                    "w-full rounded-t-[3px]",
                    isCurrent ? "bg-primary" : "bg-muted-foreground/35",
                  )}
                  style={{ height: `${Math.max(3, ratio * 100)}%` }}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex gap-1">
        {points.map((point) => (
          <span
            key={point.key}
            className={cn(
              // `min-w-0` + `truncate` : sur un écran très étroit, douze
              // abréviations de mois pèsent plus que la largeur disponible et
              // pousseraient toute la page ; elles se rognent au lieu de ça.
              "min-w-0 flex-1 truncate text-center text-[10px]",
              point.key === currentKey ? "text-foreground font-medium" : "text-subtle-foreground",
            )}
          >
            {point.label}
          </span>
        ))}
      </div>
      <figcaption className="sr-only">
        Chiffre d&apos;affaires facturable mois par mois sur les douze derniers mois.
      </figcaption>
    </figure>
  );
}
