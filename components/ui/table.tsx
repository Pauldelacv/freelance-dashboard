import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Tableau dense.
 *
 * Le conteneur défile horizontalement plutôt que de laisser la page déborder :
 * sur un écran étroit, c'est le tableau qui doit glisser, pas la mise en page.
 * Les colonnes secondaires se masquent en dessous de `md` (`hidden md:table-cell`)
 * pour que ce défilement reste l'exception.
 *
 * `relative` n'est pas décoratif : sans bloc conteneur ici, un descendant en
 * `position: absolute` — le `sr-only` de la colonne d'actions, par exemple — se
 * positionne par rapport à la page, échappe au défilement du tableau et
 * élargit tout l'écran de la largeur du tableau.
 */
export function TableWrap({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("relative w-full overflow-x-auto", className)} {...props} />;
}

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full border-collapse text-sm", className)} {...props} />;
}

export function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("border-border border-b", className)} {...props} />;
}

export function TBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-border divide-y", className)} {...props} />;
}

export function TFoot({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tfoot className={cn("border-border bg-muted/40 border-t font-medium", className)} {...props} />
  );
}

export function TR({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("hover:bg-muted/40 transition-colors", className)} {...props} />;
}

/**
 * Cellule d'en-tête. `numeric` aligne à droite : une colonne de montants ne se
 * compare à l'œil que si les unités sont sur la même verticale.
 */
export function TH({
  className,
  numeric,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        "metric-label px-3 py-2 whitespace-nowrap",
        numeric ? "text-right" : "text-left",
        className,
      )}
      {...props}
    />
  );
}

export function TD({
  className,
  numeric,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn("px-3 py-2", numeric ? "tabular text-right whitespace-nowrap" : "", className)}
      {...props}
    />
  );
}
