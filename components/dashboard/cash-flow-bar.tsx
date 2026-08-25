import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export interface CashSegment {
  label: string;
  amount: number;
  /** Classe de fond du segment. */
  color: string;
  hint: string;
}

/**
 * « Ce qui doit encore rentrer », en une seule barre.
 *
 * Trois tuiles côte à côte présentent « à facturer », « facturé » et
 * « encaissé » comme trois sujets indépendants. Ce sont en réalité **trois
 * étapes du même euro** : une barre segmentée le montre, et donne en prime la
 * proportion — savoir que 60 % de l'encours attend encore une facture de votre
 * part, c'est une information que trois nombres isolés ne donnent jamais.
 *
 * L'encaissé de l'année est délibérément **hors de cette barre** : il porte sur
 * une autre période et n'est plus un encours. Le mélanger gonflerait le total
 * d'un montant déjà sur le compte.
 */
export function CashFlowBar({ segments }: { segments: CashSegment[] }) {
  const total = segments.reduce((sum, segment) => sum + segment.amount, 0);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="metric-label">Encours total</p>
        <p className="tabular mt-0.5 text-2xl font-semibold">{formatMoney(total)}</p>
      </div>

      {total > 0 ? (
        <div className="bg-muted flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden>
          {segments
            .filter((segment) => segment.amount > 0)
            .map((segment) => (
              <div
                key={segment.label}
                className={cn("h-full first:rounded-l-full last:rounded-r-full", segment.color)}
                style={{ width: `${(segment.amount / total) * 100}%` }}
              />
            ))}
        </div>
      ) : (
        <div className="bg-muted h-2 rounded-full" aria-hidden />
      )}

      <dl className="divide-border flex flex-col divide-y">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-baseline gap-3 py-2 first:pt-1 last:pb-0">
            <span
              aria-hidden
              className={cn("size-2 shrink-0 translate-y-px rounded-full", segment.color)}
            />
            <div className="min-w-0 flex-1">
              <dt className="text-sm">{segment.label}</dt>
              <dd className="text-subtle-foreground truncate text-xs">{segment.hint}</dd>
            </div>
            <dd className="tabular shrink-0 text-sm font-medium">{formatMoney(segment.amount)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
