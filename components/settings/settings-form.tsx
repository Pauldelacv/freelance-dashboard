"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toEuros } from "@/lib/money";
import type { AppSettings } from "@/lib/settings";
import type { FormState } from "@/lib/validation";
import { saveSettingsAction } from "@/app/(app)/reglages/actions";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Enregistrement…" : "Enregistrer"}
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

export function SettingsForm({ settings }: { settings: AppSettings }) {
  const [state, formAction] = useActionState<FormState, FormData>(saveSettingsAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Facturation</CardTitle>
        </CardHeader>
        <CardContent>
          <Field
            label="URL de votre espace Indy"
            htmlFor="indyUrl"
            hint="Ajoute un lien direct dans la navigation et sur chaque fiche client."
            error={state.fieldErrors?.indyUrl}
          >
            <Input
              id="indyUrl"
              name="indyUrl"
              placeholder="https://app.indy.fr"
              defaultValue={settings.indyUrl}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Objectifs par défaut</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="CA mensuel visé (€)"
            htmlFor="monthlyRevenue"
            hint="Sert de repère sur le tableau de bord."
            error={state.fieldErrors?.monthlyRevenue}
          >
            <Input
              id="monthlyRevenue"
              name="monthlyRevenue"
              inputMode="decimal"
              placeholder="8000"
              defaultValue={
                settings.goals.monthlyRevenue ? String(toEuros(settings.goals.monthlyRevenue)) : ""
              }
            />
          </Field>
          <Field
            label="Jours travaillés visés"
            htmlFor="monthlyDays"
            error={state.fieldErrors?.monthlyDays}
          >
            <Input
              id="monthlyDays"
              name="monthlyDays"
              inputMode="decimal"
              placeholder="15"
              defaultValue={settings.goals.monthlyDays ?? ""}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fiscalité</CardTitle>
          <p className="text-muted-foreground text-sm">
            Utilisé par le simulateur de TJM. La comptabilité reste dans Indy.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Taux de cotisations (%)"
            htmlFor="chargeRate"
            hint="26,1 % par défaut."
            error={state.fieldErrors?.chargeRate}
          >
            <Input
              id="chargeRate"
              name="chargeRate"
              type="number"
              step="0.1"
              min="0"
              max="90"
              defaultValue={(settings.tax.chargeRate * 100).toFixed(1)}
            />
          </Field>
          <Field
            label="Taux de TVA (%)"
            htmlFor="vatRate"
            hint="Ignoré tant que la TVA n'est pas activée."
            error={state.fieldErrors?.vatRate}
          >
            <Input
              id="vatRate"
              name="vatRate"
              type="number"
              step="0.1"
              min="0"
              max="30"
              defaultValue={(settings.tax.vatRate * 100).toFixed(1)}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              name="vat"
              defaultChecked={settings.tax.vat}
              className="border-input size-4 rounded"
            />
            Assujetti à la TVA
            <span className="text-muted-foreground text-xs">
              (décoché = franchise en base, art. 293 B du CGI)
            </span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Saisie</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field
            label="Durée posée par défaut au clic"
            htmlFor="defaultFraction"
            hint="Maj+clic pose toujours une demi-journée."
          >
            <select
              id="defaultFraction"
              name="defaultFraction"
              defaultValue={String(settings.workday.defaultFraction)}
              className="border-input bg-card h-9 w-full rounded-lg border px-3 text-sm shadow-xs sm:w-64"
            >
              <option value="1">Journée complète</option>
              <option value="0.5">Demi-journée</option>
            </select>
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="expenses"
              defaultChecked={settings.modules.expenses}
              className="border-input size-4 rounded"
            />
            Activer le suivi des dépenses
            <span className="text-muted-foreground text-xs">(désactivé : Indy le fait déjà)</span>
          </label>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <SaveButton />
        {state.ok ? (
          <span className="text-success flex items-center gap-1 text-sm">
            <Check className="size-4" />
            Réglages enregistrés
          </span>
        ) : null}
        {state.error ? <span className="text-danger text-sm">{state.error}</span> : null}
      </div>
    </form>
  );
}
