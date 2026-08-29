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
import { CLIENT_COLORS, type FormState } from "@/lib/validation";
import { toEuros } from "@/lib/money";
import { createClientAction, updateClientAction } from "@/app/(app)/clients/actions";

export interface ClientFormValues {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  defaultRate: number;
  color: string;
  status: string;
  paymentTerms: number;
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
  hint,
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

export function ClientFormDialog({
  client,
  trigger,
}: {
  client?: ClientFormValues;
  trigger?: React.ReactNode;
}) {
  const isEdit = Boolean(client);
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState(client?.color ?? CLIENT_COLORS[0]);
  const [state, formAction] = useActionState<FormState, FormData>(
    isEdit ? updateClientAction : createClientAction,
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
            Nouveau client
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier le client" : "Nouveau client"}</DialogTitle>
          <DialogDescription>
            Le TJM saisi ici sert de valeur par défaut. Les jours déjà cochés gardent le TJM figé au
            moment de leur saisie.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          {client ? <input type="hidden" name="id" value={client.id} /> : null}
          <input type="hidden" name="color" value={color} />

          <Field label="Nom" htmlFor="name" error={state.fieldErrors?.name}>
            <Input id="name" name="name" defaultValue={client?.name} required autoFocus />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Société" htmlFor="company">
              <Input id="company" name="company" defaultValue={client?.company ?? ""} />
            </Field>
            <Field label="TJM (€)" htmlFor="defaultRate" error={state.fieldErrors?.defaultRate}>
              <Input
                id="defaultRate"
                name="defaultRate"
                inputMode="decimal"
                placeholder="550"
                defaultValue={client ? String(toEuros(client.defaultRate)) : ""}
                required
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="E-mail" htmlFor="email" error={state.fieldErrors?.email}>
              <Input id="email" name="email" type="email" defaultValue={client?.email ?? ""} />
            </Field>
            <Field label="Téléphone" htmlFor="phone">
              <Input id="phone" name="phone" defaultValue={client?.phone ?? ""} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Délai de paiement (jours)"
              htmlFor="paymentTerms"
              error={state.fieldErrors?.paymentTerms}
              hint="Base du prévisionnel de trésorerie."
            >
              <Input
                id="paymentTerms"
                name="paymentTerms"
                type="number"
                min={0}
                max={180}
                defaultValue={client?.paymentTerms ?? 30}
              />
            </Field>
            <Field label="Statut" htmlFor="status">
              <select
                id="status"
                name="status"
                defaultValue={client?.status ?? "active"}
                className="border-input bg-card h-9 w-full rounded-lg border px-3 text-sm shadow-xs"
              >
                <option value="active">Actif</option>
                <option value="prospect">Prospect</option>
                <option value="archived">Archivé</option>
              </select>
            </Field>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Couleur dans le calendrier</Label>
            <div className="flex flex-wrap gap-2">
              {CLIENT_COLORS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`Couleur ${value}`}
                  aria-pressed={color === value}
                  onClick={() => setColor(value)}
                  className="size-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: value,
                    borderColor: color === value ? "var(--foreground)" : "transparent",
                  }}
                />
              ))}
            </div>
          </div>

          <Field label="Notes" htmlFor="notes">
            <Textarea id="notes" name="notes" defaultValue={client?.notes ?? ""} />
          </Field>

          {state.error ? <p className="text-danger text-sm">{state.error}</p> : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Annuler
              </Button>
            </DialogClose>
            <SubmitButton label={isEdit ? "Enregistrer" : "Créer le client"} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
