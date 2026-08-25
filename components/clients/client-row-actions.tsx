"use client";

import { useState, useTransition } from "react";
import { Archive, Pencil, Trash2 } from "lucide-react";
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
import { ClientFormDialog, type ClientFormValues } from "@/components/clients/client-form-dialog";
import { deleteClientAction, setClientStatusAction } from "@/app/(app)/clients/actions";

/**
 * Actions au bout de la ligne : modifier, supprimer.
 *
 * La suppression est définitive et refusée dès qu'un jour est rattaché au
 * client — l'historique de CA est bâti sur ces jours. Plutôt que d'afficher un
 * refus sec, la boîte de dialogue propose alors l'archivage, qui est
 * l'opération réellement voulue dans ce cas : le client sort des sélecteurs
 * sans que le passé bouge.
 */
export function ClientRowActions({
  client,
  workDayCount,
}: {
  client: ClientFormValues;
  workDayCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const hasDays = workDayCount > 0;
  const isArchived = client.status === "archived";

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await deleteClientAction(client.id);
      if (result.error) setError(result.error);
      else setOpen(false);
    });
  }

  function archive() {
    startTransition(async () => {
      await setClientStatusAction(client.id, "archived");
      setOpen(false);
    });
  }

  return (
    <div className="flex items-center justify-end gap-0.5">
      <ClientFormDialog
        client={client}
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label={`Modifier ${client.name}`}>
            <Pencil />
          </Button>
        }
      />

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
            aria-label={`Supprimer ${client.name}`}
            className="hover:text-danger"
          >
            <Trash2 />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer {client.name} ?</DialogTitle>
            <DialogDescription>
              {hasDays
                ? `Ce client porte ${workDayCount} jour${workDayCount > 1 ? "s" : ""} saisi${
                    workDayCount > 1 ? "s" : ""
                  } : les supprimer effacerait le CA correspondant de tout l'historique. L'archivage le retire des sélecteurs sans toucher aux jours déjà cochés.`
                : "Aucun jour n'est rattaché à ce client : la suppression est définitive et ne modifie aucun historique."}
            </DialogDescription>
          </DialogHeader>

          {error ? <p className="text-danger text-sm">{error}</p> : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Annuler
              </Button>
            </DialogClose>

            {hasDays && !isArchived ? (
              <Button type="button" variant="secondary" onClick={archive} disabled={pending}>
                <Archive />
                Archiver
              </Button>
            ) : null}

            <Button type="button" variant="danger" onClick={remove} disabled={pending || hasDays}>
              {pending ? "Suppression…" : "Supprimer définitivement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
