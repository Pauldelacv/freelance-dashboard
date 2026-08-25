"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toEuros } from "@/lib/money";
import { STAGES, STAGE_LABELS, type Stage } from "@/lib/calculations/pipeline";
import type { FormState } from "@/lib/validation";
import { createProspectAction, updateProspectAction } from "@/app/(app)/prospects/actions";

export interface ProspectFormValues {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  stage: string;
  estimatedRate: number | null;
  estimatedDays: number | null;
  probability: number;
  nextAction: string | null;
  nextActionAt: string | null;
  notes: string | null;
}

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
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-danger text-xs">{error}</p> : null}
    </div>
  );
}

export function ProspectFormDialog({
  prospect,
  defaultStage,
  trigger,
}: {
  prospect?: ProspectFormValues;
  defaultStage?: Stage;
  trigger?: React.ReactNode;
}) {
  const isEdit = Boolean(prospect);
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<FormState, FormData>(
    isEdit ? updateProspectAction : createProspectAction,
    {},
  );

  // On dépend de l'objet d'état, pas de `state.ok` : useActionState renvoie un
  // nouvel objet à chaque envoi, sinon une deuxième création d'affilée laisserait
  // la boîte de dialogue ouverte (`ok` valant déjà true).
  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus />
            Nouveau prospect
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier le prospect" : "Nouveau prospect"}</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          {prospect ? <input type="hidden" name="id" value={prospect.id} /> : null}

          <Field label="Intitulé" htmlFor="name" error={state.fieldErrors?.name}>
            <Input id="name" name="name" defaultValue={prospect?.name} required autoFocus />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Société" htmlFor="company">
              <Input id="company" name="company" defaultValue={prospect?.company ?? ""} />
            </Field>
            <Field label="Source" htmlFor="source">
              <Input
                id="source"
                name="source"
                placeholder="recommandation, LinkedIn…"
                defaultValue={prospect?.source ?? ""}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="E-mail" htmlFor="email" error={state.fieldErrors?.email}>
              <Input id="email" name="email" type="email" defaultValue={prospect?.email ?? ""} />
            </Field>
            <Field label="Téléphone" htmlFor="phone">
              <Input id="phone" name="phone" defaultValue={prospect?.phone ?? ""} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="TJM pressenti (€)"
              htmlFor="estimatedRate"
              error={state.fieldErrors?.estimatedRate}
            >
              <Input
                id="estimatedRate"
                name="estimatedRate"
                inputMode="decimal"
                placeholder="600"
                defaultValue={
                  prospect?.estimatedRate ? String(toEuros(prospect.estimatedRate)) : ""
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
                placeholder="10"
                defaultValue={prospect?.estimatedDays ?? ""}
              />
            </Field>
            <Field label="Probabilité (%)" htmlFor="probability">
              <Input
                id="probability"
                name="probability"
                type="number"
                min={0}
                max={100}
                step={5}
                defaultValue={prospect?.probability ?? 50}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Étape" htmlFor="stage">
              <select
                id="stage"
                name="stage"
                defaultValue={prospect?.stage ?? defaultStage ?? "contacted"}
                className="border-input bg-card h-9 w-full rounded-lg border px-3 text-sm shadow-xs"
              >
                {STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {STAGE_LABELS[stage]}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Prochaine action le"
              htmlFor="nextActionAt"
              error={state.fieldErrors?.nextActionAt}
            >
              <Input
                id="nextActionAt"
                name="nextActionAt"
                type="date"
                defaultValue={prospect?.nextActionAt ?? ""}
              />
            </Field>
          </div>

          <Field label="Prochaine action" htmlFor="nextAction">
            <Input
              id="nextAction"
              name="nextAction"
              placeholder="Relancer le devis"
              defaultValue={prospect?.nextAction ?? ""}
            />
          </Field>

          <Field label="Notes" htmlFor="notes">
            <Textarea id="notes" name="notes" defaultValue={prospect?.notes ?? ""} />
          </Field>

          {state.error ? <p className="text-danger text-sm">{state.error}</p> : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Annuler
              </Button>
            </DialogClose>
            <SubmitButton label={isEdit ? "Enregistrer" : "Créer"} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
