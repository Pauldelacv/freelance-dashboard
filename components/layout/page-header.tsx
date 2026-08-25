import type { ReactNode } from "react";

/**
 * En-tête de page. Le titre reste petit : sur un outil qu'on ouvre vingt fois
 * par jour, on sait déjà où on est — c'est la donnée qui doit occuper le haut
 * de l'écran, pas son étiquette.
 */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h1 className="text-base font-semibold">{title}</h1>
        {description ? <p className="text-muted-foreground mt-0.5 text-sm">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </header>
  );
}
