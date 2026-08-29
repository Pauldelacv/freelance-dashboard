"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Check, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MIN_PASSWORD_LENGTH, type FormState } from "@/lib/validation";
import { changePasswordAction } from "@/app/(app)/reglages/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <KeyRound />
      {pending ? "Modification…" : "Changer le mot de passe"}
    </Button>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
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

export function PasswordForm() {
  const [state, formAction] = useActionState<FormState, FormData>(changePasswordAction, {});
  const form = useRef<HTMLFormElement>(null);

  // On dépend de l'objet d'état et non de `state.ok` : useActionState renvoie un
  // nouvel objet à chaque envoi, sinon un second changement ne viderait plus les
  // champs (`ok` valant déjà true).
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mot de passe</CardTitle>
        <p className="text-muted-foreground text-sm">
          Le nouveau mot de passe est enregistré dans la base du volume <code>/data</code> et
          remplace celui de la variable <code>APP_PASSWORD_HASH</code>. Les autres appareils déjà
          connectés devront se reconnecter.
        </p>
      </CardHeader>
      <CardContent>
        <form ref={form} action={formAction} className="flex flex-col gap-4">
          <Field
            label="Mot de passe actuel"
            htmlFor="currentPassword"
            error={state.fieldErrors?.currentPassword}
          >
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Nouveau mot de passe"
              htmlFor="newPassword"
              hint={`${MIN_PASSWORD_LENGTH} caractères minimum.`}
              error={state.fieldErrors?.newPassword}
            >
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                required
              />
            </Field>
            <Field
              label="Confirmation"
              htmlFor="confirmPassword"
              error={state.fieldErrors?.confirmPassword}
            >
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
              />
            </Field>
          </div>

          <div className="flex items-center gap-3">
            <SubmitButton />
            {state.ok ? (
              <span className="text-success flex items-center gap-1 text-sm">
                <Check className="size-4" />
                Mot de passe modifié
              </span>
            ) : null}
            {state.error ? <span className="text-danger text-sm">{state.error}</span> : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
