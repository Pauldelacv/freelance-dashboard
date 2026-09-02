"use client";

import { useState, useTransition } from "react";
import { Check, CircleAlert, Copy, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { formatLongDate } from "@/lib/dates";
import type { DeclarationNotice as Notice } from "@/lib/queries/dashboard";
import { setDeclarationDoneAction } from "@/app/(app)/actions";

/**
 * Échéance de déclaration trimestrielle URSSAF (issue #31).
 *
 * Elle apparaît le jour où la déclaration s'ouvre et ne s'en va que lorsqu'on
 * la marque faite : le dashboard n'a aucun moyen de le savoir tout seul. Le
 * montant affiché est le **CA encaissé du trimestre**, c'est-à-dire ce qui se
 * reporte dans la déclaration — pas le CA facturé.
 *
 * Sa place ici, en tête de « ce qui doit encore rentrer », tient à ce qu'on
 * vient y lire : cet encadré parle des mêmes euros, vus depuis l'autre bout.
 */
export function DeclarationNotice({ notice }: { notice: Notice }) {
  const [pending, startTransition] = useTransition();
  // `null` = on suit le serveur ; une valeur = l'utilisateur vient de cliquer,
  // et c'est ce clic qui commande l'affichage. C'est ce qui permet de garder
  // le « Annuler » sous les yeux : le rendu serveur, lui, a déjà escamoté
  // l'encadré.
  const [justSet, setJustSet] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  const done = justSet ?? notice.done;

  function setDeclarationDone(next: boolean) {
    setJustSet(next);
    startTransition(async () => {
      await setDeclarationDoneAction({ key: notice.key, done: next });
    });
  }

  // Déclaration faite lors d'une visite précédente : plus rien à afficher.
  if (done && justSet === null) return null;

  if (done) {
    return (
      <div className="border-border text-muted-foreground flex items-center justify-between gap-3 border-b px-4 py-2.5 text-xs">
        <span>Déclaration du {notice.label} marquée faite.</span>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => setDeclarationDone(false)}
        >
          <Undo2 />
          Annuler
        </Button>
      </div>
    );
  }

  const countdown = notice.overdue
    ? `en retard de ${plural(-notice.daysLeft, "jour")}`
    : notice.daysLeft === 0
      ? "dernier jour"
      : `${plural(notice.daysLeft, "jour")} restant${notice.daysLeft > 1 ? "s" : ""}`;

  async function copy() {
    await navigator.clipboard.writeText(
      [
        `Déclaration URSSAF — ${notice.label}`,
        `CA encaissé : ${formatMoney(notice.collected)}`,
        "TVA non applicable, art. 293 B du CGI",
      ].join("\n"),
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="border-border border-b px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-sm font-medium">Déclaration URSSAF · {notice.label}</p>
        <Badge variant={notice.overdue ? "danger" : notice.daysLeft <= 7 ? "warning" : "muted"}>
          {notice.overdue ? <CircleAlert className="size-3" /> : null}
          {countdown}
        </Badge>
      </div>

      <p className="text-subtle-foreground mt-0.5 text-xs">
        À déclarer avant le {formatLongDate(notice.dueAt)}.
      </p>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-muted-foreground text-xs">
          CA encaissé du trimestre{" "}
          <span className="tabular text-foreground font-medium">
            {formatMoney(notice.collected)}
          </span>
        </span>
        <span className="text-subtle-foreground text-xs">
          cotisations estimées <span className="tabular">{formatMoney(notice.charges)}</span>
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {notice.collected > 0 ? (
          <Button variant="outline" size="sm" onClick={copy}>
            {copied ? <Check /> : <Copy />}
            {copied ? "Copié" : "Copier le récap"}
          </Button>
        ) : null}
        <Button size="sm" disabled={pending} onClick={() => setDeclarationDone(true)}>
          Déclaration faite
        </Button>
      </div>

      {/* Le chiffre vient des pointages « encaissé » du dashboard : le dire
          évite de le recopier les yeux fermés dans un formulaire fiscal. */}
      <p className="text-subtle-foreground mt-2 text-xs">
        {notice.collected > 0
          ? "Montant indicatif, calculé sur les jours et forfaits pointés « encaissé ». La déclaration se fait sur urssaf.fr."
          : "Aucun encaissement pointé sur ce trimestre : le montant à déclarer est à relire dans Indy. La déclaration se fait sur urssaf.fr."}
      </p>
    </div>
  );
}

function plural(count: number, word: string): string {
  return `${count.toLocaleString("fr-FR")} ${word}${count > 1 ? "s" : ""}`;
}
