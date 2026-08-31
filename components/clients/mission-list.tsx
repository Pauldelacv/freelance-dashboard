"use client";

import { useState, useTransition } from "react";
import { Check, Copy, ExternalLink, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  MissionFormDialog,
  type MissionFormValues,
} from "@/components/clients/mission-form-dialog";
import { formatMoney } from "@/lib/money";
import { formatDayMonth } from "@/lib/dates";
import type { BillingStatus } from "@/lib/calculations/revenue";
import {
  deleteMissionAction,
  setMissionBillingAction,
} from "@/app/(app)/clients/[id]/mission-actions";

export interface MissionRowValues extends MissionFormValues {
  billing: string;
  billedAt: string | null;
  paidAt: string | null;
  workDayCount: number;
}

const STATUS_LABELS: Record<string, string> = {
  active: "En cours",
  paused: "En pause",
  done: "Terminée",
};

const BILLING_LABELS: Record<string, string> = {
  pending: "À facturer",
  invoiced: "Facturé",
  paid: "Encaissé",
};

/** Le texte à coller dans Indy pour facturer un forfait. */
function recapText(clientName: string, mission: MissionRowValues): string {
  return [
    `${clientName} — ${mission.title}`,
    `Forfait : ${formatMoney(mission.forfaitAmount ?? 0)}`,
    "TVA non applicable, art. 293 B du CGI",
  ].join("\n");
}

/**
 * Missions du client.
 *
 * Une mission en régie ne porte qu'un TJM : ce sont les jours cochés qui font
 * le CA, et son suivi de facturation est celui du mois, juste au-dessus. Une
 * mission au forfait, elle, est une facture à elle seule — d'où les mêmes trois
 * états qu'un mois de régie (à facturer → facturé → encaissé) et son propre
 * récapitulatif copiable vers Indy.
 */
export function MissionList({
  clientId,
  clientName,
  clientRate,
  missions,
  indyUrl,
}: {
  clientId: string;
  clientName: string;
  clientRate: number;
  missions: MissionRowValues[];
  indyUrl: string;
}) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState<string | null>(null);

  if (missions.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-muted-foreground text-sm">
          Aucune mission. Utile pour un TJM différent de celui du client, ou pour une prestation
          vendue au forfait — un montant unique, sans jours à cocher.
        </p>
        <MissionFormDialog clientId={clientId} clientRate={clientRate} />
      </div>
    );
  }

  async function copy(mission: MissionRowValues) {
    await navigator.clipboard.writeText(recapText(clientName, mission));
    setCopied(mission.id);
    setTimeout(() => setCopied(null), 2000);
  }

  function setBilling(mission: MissionRowValues, billing: BillingStatus) {
    startTransition(async () => {
      await setMissionBillingAction({ id: mission.id, billing });
    });
  }

  return (
    <div className="flex flex-col">
      <ul className="divide-border divide-y">
        {missions.map((mission) => {
          const forfait = mission.billingType === "forfait";
          return (
            <li key={mission.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
              <div className="min-w-40 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {mission.title}
                  {mission.status !== "active" ? (
                    <Badge variant="muted">{STATUS_LABELS[mission.status] ?? mission.status}</Badge>
                  ) : null}
                </p>
                <p className="text-subtle-foreground text-xs">
                  {forfait
                    ? "Forfait"
                    : `Régie · ${formatMoney(mission.rate ?? clientRate)}${
                        mission.estimatedDays
                          ? ` · ${mission.estimatedDays.toLocaleString("fr-FR")} j estimés`
                          : ""
                      }`}
                  {mission.startDate ? ` · dès le ${formatDayMonth(mission.startDate)}` : ""}
                  {mission.endDate ? ` → ${formatDayMonth(mission.endDate)}` : ""}
                  {!forfait && mission.workDayCount > 0
                    ? ` · ${mission.workDayCount} jour${mission.workDayCount > 1 ? "s" : ""} coché${mission.workDayCount > 1 ? "s" : ""}`
                    : ""}
                </p>
              </div>

              {forfait ? (
                <>
                  <span className="tabular text-sm font-medium">
                    {formatMoney(mission.forfaitAmount ?? 0)}
                  </span>
                  <Badge
                    variant={
                      mission.billing === "paid"
                        ? "success"
                        : mission.billing === "invoiced"
                          ? "default"
                          : "warning"
                    }
                  >
                    {BILLING_LABELS[mission.billing] ?? mission.billing}
                    {mission.billing === "invoiced" && mission.billedAt
                      ? ` · ${formatDayMonth(mission.billedAt)}`
                      : ""}
                  </Badge>
                </>
              ) : null}

              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                {forfait && mission.billing === "pending" ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => copy(mission)}>
                      {copied === mission.id ? <Check /> : <Copy />}
                      {copied === mission.id ? "Copié" : "Copier le récap"}
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
                      onClick={() => setBilling(mission, "invoiced")}
                    >
                      Marquer facturé
                    </Button>
                  </>
                ) : null}

                {forfait && mission.billing === "invoiced" ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={pending}
                    onClick={() => setBilling(mission, "paid")}
                  >
                    Marquer encaissé
                  </Button>
                ) : null}

                {forfait && mission.billing !== "pending" ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Rouvrir ${mission.title}`}
                    disabled={pending}
                    onClick={() =>
                      setBilling(mission, mission.billing === "paid" ? "invoiced" : "pending")
                    }
                  >
                    <RotateCcw />
                  </Button>
                ) : null}

                <MissionFormDialog
                  clientId={clientId}
                  clientRate={clientRate}
                  mission={mission}
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label={`Modifier ${mission.title}`}>
                      <Pencil />
                    </Button>
                  }
                />
                <DeleteMission mission={mission} />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="pt-3">
        <MissionFormDialog clientId={clientId} clientRate={clientRate} />
      </div>
    </div>
  );
}

/** Suppression définitive, refusée dès qu'un jour coché est rattaché. */
function DeleteMission({ mission }: { mission: MissionRowValues }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const hasDays = mission.workDayCount > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Supprimer ${mission.title}`}
          className="hover:text-danger"
        >
          <Trash2 />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Supprimer {mission.title} ?</DialogTitle>
          <DialogDescription>
            {hasDays
              ? `Cette mission porte ${mission.workDayCount} jour${
                  mission.workDayCount > 1 ? "s" : ""
                } coché${mission.workDayCount > 1 ? "s" : ""} : passez-la en « terminée » plutôt que de la supprimer.`
              : "Aucun jour n'y est rattaché : la suppression est définitive et ne touche à aucun historique."}
          </DialogDescription>
        </DialogHeader>

        {error ? <p className="text-danger text-sm">{error}</p> : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Annuler
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="danger"
            disabled={pending || hasDays}
            onClick={() =>
              startTransition(async () => {
                const result = await deleteMissionAction(mission.id);
                if (result.error) setError(result.error);
                else setOpen(false);
              })
            }
          >
            {pending ? "Suppression…" : "Supprimer définitivement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
