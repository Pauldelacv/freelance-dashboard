"use client";

import { useState, useTransition } from "react";
import { Check, Copy, ExternalLink, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";
import { formatMonthLabel } from "@/lib/dates";
import {
  closeMonthAction,
  markMonthPaidAction,
  reopenMonthAction,
} from "@/app/(app)/clients/[id]/billing-actions";

export interface MonthRow {
  key: string;
  pendingDays: number;
  pendingRevenue: number;
  invoicedDays: number;
  invoicedRevenue: number;
  paidRevenue: number;
  rate: number;
}

/** Le texte à coller dans Indy au moment de créer la facture. */
function recapText(clientName: string, month: MonthRow): string {
  const [year, monthNumber] = month.key.split("-").map(Number);
  const label = formatMonthLabel(year, monthNumber);
  const days = month.pendingDays.toLocaleString("fr-FR");
  return [
    `${clientName} — prestations ${label}`,
    `${days} jour${month.pendingDays > 1 ? "s" : ""} × ${formatMoney(month.rate)} = ${formatMoney(month.pendingRevenue)}`,
    "TVA non applicable, art. 293 B du CGI",
  ].join("\n");
}

export function MonthClosing({
  clientId,
  clientName,
  months,
  indyUrl,
}: {
  clientId: string;
  clientName: string;
  months: MonthRow[];
  indyUrl: string;
}) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState<string | null>(null);

  if (months.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Aucun jour facturable saisi pour ce client. Cochez des journées dans le calendrier.
      </p>
    );
  }

  async function copy(month: MonthRow) {
    await navigator.clipboard.writeText(recapText(clientName, month));
    setCopied(month.key);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="divide-border flex flex-col divide-y">
      {months.map((month) => {
        const [year, monthNumber] = month.key.split("-").map(Number);
        return (
          <div key={month.key} className="flex flex-wrap items-center gap-3 py-3 first:pt-0">
            <div className="min-w-36">
              <p className="text-sm font-medium capitalize">
                {formatMonthLabel(year, monthNumber)}
              </p>
              <p className="text-muted-foreground text-xs">
                {month.pendingDays > 0
                  ? `${month.pendingDays.toLocaleString("fr-FR")} j à facturer`
                  : month.invoicedDays > 0
                    ? `${month.invoicedDays.toLocaleString("fr-FR")} j facturés`
                    : "tout est encaissé"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {month.pendingRevenue > 0 ? (
                <Badge variant="warning">À facturer {formatMoney(month.pendingRevenue)}</Badge>
              ) : null}
              {month.invoicedRevenue > 0 ? (
                <Badge variant="default">Facturé {formatMoney(month.invoicedRevenue)}</Badge>
              ) : null}
              {month.paidRevenue > 0 ? (
                <Badge variant="success">Encaissé {formatMoney(month.paidRevenue)}</Badge>
              ) : null}
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              {month.pendingRevenue > 0 ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => copy(month)}>
                    {copied === month.key ? <Check /> : <Copy />}
                    {copied === month.key ? "Copié" : "Copier le récap"}
                  </Button>
                  {indyUrl ? (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={indyUrl} target="_blank" rel="noreferrer noopener">
                        <ExternalLink />
                        Indy
                      </a>
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await closeMonthAction({ clientId, month: month.key });
                      })
                    }
                  >
                    Marquer facturé
                  </Button>
                </>
              ) : null}

              {month.invoicedRevenue > 0 ? (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await markMonthPaidAction({ clientId, month: month.key });
                    })
                  }
                >
                  Marquer encaissé
                </Button>
              ) : null}

              {month.pendingRevenue === 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Rouvrir le mois"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await reopenMonthAction({ clientId, month: month.key });
                    })
                  }
                >
                  <RotateCcw />
                </Button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
