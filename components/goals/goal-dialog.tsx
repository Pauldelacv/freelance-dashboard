"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Target } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { formatMoney, parseMoney, toEuros } from "@/lib/money";
import { formatMonthShort } from "@/lib/dates";
import { splitDays, splitEvenly } from "@/lib/calculations/goals";
import type { GoalValues, YearGoals } from "@/lib/queries/goals";
import type { FormState } from "@/lib/validation";
import { saveGoalAction } from "@/app/(app)/actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Enregistrement…" : label}
    </Button>
  );
}

function moneyValue(target: number | null | undefined): string {
  return target === null || target === undefined ? "" : String(toEuros(target));
}

function daysValue(target: number | null | undefined): string {
  return target === null || target === undefined ? "" : String(target).replace(".", ",");
}

/**
 * Saisie des objectifs, depuis le tableau de bord comme depuis le calendrier.
 *
 * Deux formulaires distincts dans une même boîte : l'objectif du mois affiché,
 * et l'objectif annuel avec sa répartition. Ce sont deux gestes différents —
 * corriger le mois en cours, ou poser l'année entière — et les mêler dans un
 * seul envoi obligerait à deviner lequel des deux on voulait modifier.
 */
export function GoalDialog({
  year,
  month,
  monthLabel,
  goals,
  fallback,
  trigger,
}: {
  year: number;
  month: number;
  monthLabel: string;
  goals: YearGoals;
  /** Objectifs par défaut des réglages, repris quand le mois n'a pas les siens. */
  fallback: GoalValues;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const monthGoal = goals.byMonth[month] ?? null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Target />
            Objectif
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Objectifs</DialogTitle>
          <DialogDescription>
            Chaque mois porte son propre objectif. Sans objectif propre, un mois reprend la valeur
            par défaut des réglages.
          </DialogDescription>
        </DialogHeader>

        <MonthForm
          year={year}
          month={month}
          monthLabel={monthLabel}
          goal={monthGoal}
          fallback={fallback}
          onDone={() => setOpen(false)}
        />

        <div className="border-border mt-5 border-t pt-5">
          <AnnualForm year={year} goals={goals} onDone={() => setOpen(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MonthForm({
  year,
  month,
  monthLabel,
  goal,
  fallback,
  onDone,
}: {
  year: number;
  month: number;
  monthLabel: string;
  goal: GoalValues | null;
  fallback: GoalValues;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(saveGoalAction, {});

  // Comme ailleurs : on suit l'objet d'état, pas `state.ok`, sinon deux envois
  // d'affilée ne referment plus la boîte.
  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="month" value={month} />

      <p className="text-sm font-medium capitalize">{monthLabel}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="month-revenue">CA visé (€)</Label>
          <Input
            id="month-revenue"
            name="revenueTarget"
            inputMode="decimal"
            placeholder={fallback.revenueTarget ? String(toEuros(fallback.revenueTarget)) : "9000"}
            defaultValue={moneyValue(goal?.revenueTarget)}
          />
          {state.fieldErrors?.revenueTarget ? (
            <p className="text-danger text-xs">{state.fieldErrors.revenueTarget}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="month-days">Jours visés</Label>
          <Input
            id="month-days"
            name="daysTarget"
            inputMode="decimal"
            placeholder={fallback.daysTarget ? String(fallback.daysTarget) : "18"}
            defaultValue={daysValue(goal?.daysTarget)}
          />
          {state.fieldErrors?.daysTarget ? (
            <p className="text-danger text-xs">{state.fieldErrors.daysTarget}</p>
          ) : null}
        </div>
      </div>

      <p className="text-subtle-foreground text-xs">
        Champs vidés : le mois retombe sur les objectifs par défaut des réglages
        {fallback.revenueTarget ? ` (${formatMoney(fallback.revenueTarget)})` : ""}.
      </p>

      {state.error ? <p className="text-danger text-sm">{state.error}</p> : null}

      <div className="flex items-center justify-end gap-2">
        <DialogClose asChild>
          <Button type="button" variant="ghost">
            Fermer
          </Button>
        </DialogClose>
        <SubmitButton label="Enregistrer le mois" />
      </div>
    </form>
  );
}

function AnnualForm({
  year,
  goals,
  onDone,
}: {
  year: number;
  goals: YearGoals;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(saveGoalAction, {});
  const [revenue, setRevenue] = useState(moneyValue(goals.annual?.revenueTarget));
  const [days, setDays] = useState(daysValue(goals.annual?.daysTarget));
  const [distribute, setDistribute] = useState(true);

  // Répartition proposée sur les mois travaillés ; à défaut, sur l'année entière
  // — un objectif posé en janvier n'a encore aucun jour derrière lui.
  const proposed =
    goals.worked.length > 0 ? goals.worked : Array.from({ length: 12 }, (_, i) => i + 1);
  const [selected, setSelected] = useState<number[]>(proposed);

  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  const revenueCents = revenue.trim() === "" ? null : parseMoney(revenue);
  const daysNumber = days.trim() === "" ? null : Number(days.replace(",", "."));
  const share =
    distribute && selected.length > 0
      ? {
          revenue: revenueCents === null ? null : splitEvenly(revenueCents, selected.length)[0],
          days:
            daysNumber === null || Number.isNaN(daysNumber)
              ? null
              : splitDays(daysNumber, selected.length)[0],
        }
      : null;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="month" value="" />

      <p className="tabular text-sm font-medium">Année {year}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="year-revenue">CA visé (€)</Label>
          <Input
            id="year-revenue"
            name="revenueTarget"
            inputMode="decimal"
            placeholder="108000"
            value={revenue}
            onChange={(event) => setRevenue(event.target.value)}
          />
          {state.fieldErrors?.revenueTarget ? (
            <p className="text-danger text-xs">{state.fieldErrors.revenueTarget}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="year-days">Jours visés</Label>
          <Input
            id="year-days"
            name="daysTarget"
            inputMode="decimal"
            placeholder="200"
            value={days}
            onChange={(event) => setDays(event.target.value)}
          />
          {state.fieldErrors?.daysTarget ? (
            <p className="text-danger text-xs">{state.fieldErrors.daysTarget}</p>
          ) : null}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="distribute"
          checked={distribute}
          onChange={(event) => setDistribute(event.target.checked)}
          className="accent-primary size-4"
        />
        Répartir sur les mois cochés
      </label>

      {distribute ? (
        <>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => {
              const on = selected.includes(value);
              return (
                <label
                  key={value}
                  className={cn(
                    "cursor-pointer rounded-(--radius-control) border px-2 py-1 text-center text-xs capitalize transition-colors",
                    on
                      ? "border-primary bg-primary text-primary-foreground font-medium"
                      : "border-input text-muted-foreground hover:bg-muted",
                  )}
                >
                  <input
                    type="checkbox"
                    name="months"
                    value={value}
                    checked={on}
                    onChange={(event) =>
                      setSelected((current) =>
                        event.target.checked
                          ? [...current, value]
                          : current.filter((item) => item !== value),
                      )
                    }
                    className="sr-only"
                  />
                  {formatMonthShort(year, value)}
                </label>
              );
            })}
          </div>

          <p className="text-subtle-foreground text-xs">
            {selected.length === 0
              ? "Aucun mois coché : rien à répartir."
              : share
                ? `Soit ${share.revenue !== null ? formatMoney(share.revenue) : "—"}${
                    share.days !== null ? ` et ${share.days.toLocaleString("fr-FR")} j` : ""
                  } par mois sur ${selected.length} mois. Les objectifs mensuels existants sont écrasés.`
                : "Saisissez un objectif annuel à répartir."}
          </p>
          {state.fieldErrors?.months ? (
            <p className="text-danger text-xs">{state.fieldErrors.months}</p>
          ) : null}
        </>
      ) : null}

      {state.error ? <p className="text-danger text-sm">{state.error}</p> : null}

      <DialogFooter className="mt-0">
        <SubmitButton label="Enregistrer l'année" />
      </DialogFooter>
    </form>
  );
}
