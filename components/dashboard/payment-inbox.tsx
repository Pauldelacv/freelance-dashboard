"use client";

import { useState, useTransition } from "react";
import { CircleAlert, Undo2 } from "lucide-react";
import { Badge, ColorDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { formatDayMonth } from "@/lib/dates";
import type { AwaitingInvoice } from "@/lib/calculations/invoices";
import { markInvoicePaidAction, markInvoiceUnpaidAction } from "@/app/(app)/actions";
import { setMissionBillingAction } from "@/app/(app)/clients/[id]/mission-actions";

/**
 * Pointage des factures émises. Indy ne nous dit pas quand un virement arrive :
 * sans ce geste manuel, « facturé, non encaissé » ne redescend jamais et
 * l'encaissé de l'année reste à zéro.
 *
 * Une ligne = une facture, c'est-à-dire un client et un mois — la même unité
 * que la clôture de mois qui l'a créée. Pointer jour par jour n'aurait aucun
 * sens : on encaisse une facture, pas une journée. Une mission au forfait fait
 * ligne à elle seule : son statut est porté par la mission, pas par des jours.
 */
export function PaymentInbox({ items }: { items: AwaitingInvoice[] }) {
  const [pending, startTransition] = useTransition();
  // Une fois pointée, la ligne disparaît de la liste rendue par le serveur :
  // on garde de quoi défaire le dernier clic, qui est vite parti.
  const [undo, setUndo] = useState<AwaitingInvoice | null>(null);

  if (items.length === 0 && !undo) return null;

  /** Le pointage vise la mission, ou le mois de jours travaillés du client. */
  async function markPaid(item: AwaitingInvoice, paid: boolean) {
    if (item.kind === "mission" && item.missionId) {
      await setMissionBillingAction({
        id: item.missionId,
        billing: paid ? "paid" : "invoiced",
      });
      return;
    }
    const input = { clientId: item.clientId, month: item.month };
    await (paid ? markInvoicePaidAction(input) : markInvoiceUnpaidAction(input));
  }

  return (
    <div className="border-border border-t">
      <p className="metric-label px-4 pt-3 pb-1">Factures à pointer</p>

      <ul className="divide-border divide-y">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-3 px-4 py-2.5">
            {item.color ? <ColorDot color={item.color} /> : null}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium">{item.clientName}</p>
                {item.late ? (
                  <Badge variant="warning">
                    <CircleAlert className="size-3" />
                    En retard
                  </Badge>
                ) : null}
              </div>
              {/* Sur téléphone la ligne est étroite : l'échéance passe avant le
                  nombre de jours, qui se relit sur la fiche client. */}
              <p className="text-subtle-foreground truncate text-xs">
                <span className="capitalize">{item.monthLabel}</span>
                <span className="hidden sm:inline">
                  {item.kind === "mission"
                    ? ` · ${item.label ?? "forfait"}`
                    : ` · ${item.days.toLocaleString("fr-FR")} j`}
                </span>
                {item.dueAt ? ` · éch. ${formatDayMonth(item.dueAt)}` : ""}
              </p>
            </div>
            <span className="tabular shrink-0 text-sm font-medium">{formatMoney(item.amount)}</span>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await markPaid(item, true);
                  setUndo(item);
                })
              }
            >
              Encaissé
            </Button>
          </li>
        ))}
      </ul>

      {undo ? (
        <div className="text-muted-foreground flex items-center gap-3 px-4 py-2 text-xs">
          <span className="min-w-0 flex-1 truncate">
            {formatMoney(undo.amount)} encaissé pour {undo.clientName}.
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await markPaid(undo, false);
                setUndo(null);
              })
            }
          >
            <Undo2 />
            Annuler
          </Button>
        </div>
      ) : null}
    </div>
  );
}
