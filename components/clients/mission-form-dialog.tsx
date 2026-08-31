"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatMoney, toEuros } from "@/lib/money";
import type { FormState } from "@/lib/validation";
import { createMissionAction, updateMissionAction } from "@/app/(app)/clients/[id]/mission-actions";

export interface MissionFormValues {
  id: string;
  title: string;
  billingType: string;
  rate: number | null;
  forfaitAmount: number | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  estimatedDays: number | null;
  notes: string | null;
}

const STATUS_OPTIONS = [
  { value: "active", label: "En cours" },
  { value: "paused", label: "En pause" },
  { value: "done", label: "Terminée" },
];

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Enregistrement…" : label}
    </Button>
  );
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      {error ? <p className="text-danger text-xs">{error}</p> : null}
    </div>
  );
}

const selectClass = "border-input bg-card h-9 w-full rounded-lg border px-3 text-sm shadow-xs";

/**
 * Création et modification d'une mission.
 *
 * Le formulaire bascule sur le mode de facturation : en **régie** on saisit un
 * TJM et des jours estimés — le CA viendra des journées cochées ; au
 * **forfait** un montant unique, qui *est* le CA. Afficher les deux à la fois
 * laisserait croire qu'ils s'additionnent.
 */
export function MissionFormDialog({
  clientId,
  clientRate,
  mission,
  trigger,
}: {
  clientId: string;
  /** TJM par défaut du client, proposé en repli quand la mission n'en porte pas. */
  clientRate: number;
  mission?: MissionFormValues;
  trigger?: React.ReactNode;
}) {
  const isEdit = Boolean(mission);
  const [open, setOpen] = useState(false);
  const [billingType, setBillingType] = useState(
    mission?.billingType === "forfait" ? "forfait" : "regie",
  );
  const [state, formAction] = useActionState<FormState, FormData>(
    isEdit ? updateMissionAction : createMissionAction,
    {},
  );

  // Même raison que pour le formulaire client : on dépend de l'objet d'état,
  // pas de `state.ok`, sinon une deuxième création laisse la boîte ouverte.
  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  const forfait = billingType === "forfait";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="secondary" size="sm">
            <Plus />
            Nouvelle mission
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier la mission" : "Nouvelle mission"}</DialogTitle>
          <DialogDescription>
            En régie, le CA vient des jours cochés au calendrier. Au forfait, il vient du montant
            convenu ici — la facture, elle, reste dans Indy.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="clientId" value={clientId} />
          {mission ? <input type="hidden" name="id" value={mission.id} /> : null}
          <input type="hidden" name="billingType" value={billingType} />

          <Field label="Intitulé" htmlFor="title" error={state.fieldErrors?.title}>
            <Input id="title" name="title" defaultValue={mission?.title} required autoFocus />
          </Field>

          <div className="flex flex-col gap-1.5">
            <Label>Facturation</Label>
            <div className="border-input flex h-9 w-full overflow-hidden rounded-lg border">
              {[
                { value: "regie", label: "Régie (TJM × jours)" },
                { value: "forfait", label: "Forfait (montant unique)" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setBillingType(option.value)}
                  aria-pressed={billingType === option.value}
                  className={cn(
                    "flex-1 px-3 text-sm transition-colors",
                    billingType === option.value
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {forfait ? (
            <Field
              label="Montant du forfait (€)"
              htmlFor="forfaitAmount"
              error={state.fieldErrors?.forfaitAmount}
              hint="Montant convenu pour l'ensemble de la prestation, quel que soit le nombre de jours passés."
            >
              {/* `required` plutôt que le seul contrôle serveur : React réinitialise
                  le formulaire dès qu'une action de formulaire s'achève, y compris
                  sur refus — le navigateur, lui, arrête l'envoi avant, et la saisie
                  reste à l'écran. Le contrôle serveur demeure, il garde la porte. */}
              <Input
                id="forfaitAmount"
                name="forfaitAmount"
                inputMode="decimal"
                placeholder="4 500"
                required
                defaultValue={
                  mission?.forfaitAmount === null || mission?.forfaitAmount === undefined
                    ? ""
                    : String(toEuros(mission.forfaitAmount))
                }
              />
            </Field>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="TJM de la mission (€)"
                htmlFor="rate"
                error={state.fieldErrors?.rate}
                hint={`Vide : ${formatMoney(clientRate)}, le TJM du client.`}
              >
                <Input
                  id="rate"
                  name="rate"
                  inputMode="decimal"
                  placeholder={String(toEuros(clientRate))}
                  defaultValue={
                    mission?.rate === null || mission?.rate === undefined
                      ? ""
                      : String(toEuros(mission.rate))
                  }
                />
              </Field>
              <Field
                label="Jours estimés"
                htmlFor="estimatedDays"
                error={state.fieldErrors?.estimatedDays}
              >
                <Input
                  id="estimatedDays"
                  name="estimatedDays"
                  inputMode="decimal"
                  placeholder="12"
                  defaultValue={mission?.estimatedDays ?? ""}
                />
              </Field>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Début" htmlFor="startDate" error={state.fieldErrors?.startDate}>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                defaultValue={mission?.startDate ?? ""}
              />
            </Field>
            <Field label="Fin" htmlFor="endDate" error={state.fieldErrors?.endDate}>
              <Input
                id="endDate"
                name="endDate"
                type="date"
                defaultValue={mission?.endDate ?? ""}
              />
            </Field>
            <Field label="Statut" htmlFor="status">
              <select
                id="status"
                name="status"
                defaultValue={mission?.status ?? "active"}
                className={selectClass}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Notes" htmlFor="mission-notes">
            <Textarea id="mission-notes" name="notes" defaultValue={mission?.notes ?? ""} />
          </Field>

          {state.error ? <p className="text-danger text-sm">{state.error}</p> : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Annuler
              </Button>
            </DialogClose>
            <SubmitButton label={isEdit ? "Enregistrer" : "Créer la mission"} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
