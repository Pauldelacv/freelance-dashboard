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
import type { FormState } from "@/lib/validation";
import { createSiteAction, updateSiteAction } from "@/app/(app)/veille/actions";

export interface SiteFormValues {
  id: string;
  title: string;
  url: string;
  category: string;
  tags: string;
  frequency: string | null;
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

export function SiteFormDialog({
  site,
  categories,
  trigger,
}: {
  site?: SiteFormValues;
  categories: string[];
  trigger?: React.ReactNode;
}) {
  const isEdit = Boolean(site);
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<FormState, FormData>(
    isEdit ? updateSiteAction : createSiteAction,
    {},
  );

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state.ok]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus />
            Ajouter un site
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier le site" : "Ajouter un site"}</DialogTitle>
          <DialogDescription>
            Collez l&apos;URL : le titre et le favicon sont récupérés automatiquement si vous
            laissez le champ titre vide.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          {site ? <input type="hidden" name="id" value={site.id} /> : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="url">URL</Label>
            <Input
              id="url"
              name="url"
              placeholder="https://exemple.fr"
              defaultValue={site?.url}
              required
              autoFocus
            />
            {state.fieldErrors?.url ? (
              <p className="text-danger text-xs">{state.fieldErrors.url}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Titre</Label>
            <Input
              id="title"
              name="title"
              placeholder="Laisser vide pour récupérer le titre de la page"
              defaultValue={site?.title}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category">Catégorie</Label>
              <Input
                id="category"
                name="category"
                list="watch-categories"
                placeholder="Technique"
                defaultValue={site?.category}
              />
              <datalist id="watch-categories">
                {categories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="frequency">Fréquence de consultation</Label>
              <select
                id="frequency"
                name="frequency"
                defaultValue={site?.frequency ?? ""}
                className="border-input bg-card h-9 w-full rounded-lg border px-3 text-sm shadow-xs"
              >
                <option value="">Non précisée</option>
                <option value="quotidien">Quotidienne</option>
                <option value="hebdo">Hebdomadaire</option>
                <option value="mensuel">Mensuelle</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              name="tags"
              placeholder="seo, next, veille"
              defaultValue={site?.tags}
            />
            <p className="text-muted-foreground text-xs">Séparés par des virgules.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" defaultValue={site?.notes ?? ""} />
          </div>

          {state.error ? <p className="text-danger text-sm">{state.error}</p> : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Annuler
              </Button>
            </DialogClose>
            <SubmitButton label={isEdit ? "Enregistrer" : "Ajouter"} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
