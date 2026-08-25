"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Database, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RESTORE_CONFIRMATION, type FormState } from "@/lib/validation";
import { restoreBackupAction } from "@/app/(app)/reglages/actions";

function SubmitButton({ blocked }: { blocked: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" className="self-start" disabled={pending || blocked}>
      {pending ? "Remplacement…" : "Remplacer les données"}
    </Button>
  );
}

/**
 * Import d'une sauvegarde JSON — remplacement complet.
 *
 * Le bouton reste inerte tant que le mot n'est pas écrit : un import se décide,
 * il ne se déclenche pas d'un clic distrait. Le serveur revérifie de son côté,
 * la garde d'interface n'étant qu'un garde-fou.
 */
export function DataRestore() {
  const router = useRouter();
  const [state, formAction] = useActionState<FormState, FormData>(restoreBackupAction, {});
  const [confirmation, setConfirmation] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  // Remonter le formulaire après un import : un champ fichier ne se vide pas
  // depuis React, il garde sinon le nom du fichier déjà avalé.
  const [formKey, setFormKey] = useState(0);

  // Toutes les pages déjà rendues portent les anciennes données.
  useEffect(() => {
    if (state.ok) {
      setConfirmation("");
      setFileName(null);
      setFormKey((current) => current + 1);
      router.refresh();
    }
  }, [state, router]);

  const ready = confirmation.trim().toUpperCase() === RESTORE_CONFIRMATION && fileName !== null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Restauration</CardTitle>
        <p className="text-muted-foreground text-sm">
          Relit un fichier produit par « Télécharger le JSON » et{" "}
          <strong className="font-medium">remplace toutes les données</strong> : clients, jours,
          prospects, veille, objectifs et réglages. Votre mot de passe, lui, n&apos;est pas touché.
        </p>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <p className="border-warning/40 bg-warning-soft text-warning flex items-start gap-2 rounded-(--radius-card) border p-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            Rien n&apos;est fusionné : ce qui n&apos;est pas dans le fichier disparaît. Téléchargez
            une sauvegarde de l&apos;état actuel avant de continuer.
          </span>
        </p>

        <Button variant="outline" size="sm" asChild className="self-start">
          <a href="/api/backup" download>
            <Database />
            Sauvegarder d&apos;abord
          </a>
        </Button>

        <form key={formKey} action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="backup-file">Fichier de sauvegarde</Label>
            <input
              id="backup-file"
              name="file"
              type="file"
              accept="application/json,.json"
              onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
              className="text-muted-foreground file:border-input file:bg-card file:text-foreground hover:file:bg-muted w-full text-sm file:mr-3 file:rounded-(--radius-control) file:border file:px-2.5 file:py-1 file:text-sm"
            />
            {state.fieldErrors?.file ? (
              <p className="text-danger text-xs">{state.fieldErrors.file}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmation">Tapez {RESTORE_CONFIRMATION} pour confirmer</Label>
            <Input
              id="confirmation"
              name="confirmation"
              autoComplete="off"
              placeholder={RESTORE_CONFIRMATION}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="max-w-56"
            />
            {state.fieldErrors?.confirmation ? (
              <p className="text-danger text-xs">{state.fieldErrors.confirmation}</p>
            ) : null}
          </div>

          {state.error ? <p className="text-danger text-sm">{state.error}</p> : null}
          {state.ok && state.message ? (
            <p className="text-success text-sm">{state.message}</p>
          ) : null}

          <SubmitButton blocked={!ready} />
        </form>
      </CardContent>
    </Card>
  );
}
