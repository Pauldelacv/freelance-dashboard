"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Upload } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/validation";
import { importSitesAction } from "@/app/(app)/veille/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Import…" : "Importer"}
    </Button>
  );
}

export function ImportDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<FormState, FormData>(importSitesAction, {});

  // Voir site-form-dialog : on suit l'objet d'état, pas ses champs.
  useEffect(() => {
    if (state.ok && !state.error) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload />
          Importer
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importer une liste de sites</DialogTitle>
          <DialogDescription>
            Collez un export JSON de cette application, ou un fichier OPML issu d&apos;un lecteur de
            flux. Les sites déjà présents sont ignorés.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <Textarea
            name="payload"
            rows={10}
            required
            placeholder='[{"title":"Next.js","url":"https://nextjs.org"}]'
            className="font-mono text-xs"
          />
          {state.error ? <p className="text-danger text-sm">{state.error}</p> : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Annuler
              </Button>
            </DialogClose>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
