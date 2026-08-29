"use client";

import { useMemo, useState } from "react";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { formatMoney, formatMoneyShort, toCents, toEuros } from "@/lib/money";
import {
  billableDaysPerYear,
  compareToActual,
  netFromRate,
  rateFromNet,
  simulate,
} from "@/lib/calculations/rate-simulator";
import type { SimulatorContext } from "@/lib/queries/simulator";

function Slider({
  id,
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        <span className="tabular text-sm font-medium">
          {value.toLocaleString("fr-FR")} {suffix}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="accent-primary bg-muted h-1.5 w-full cursor-pointer appearance-none rounded-full"
      />
    </div>
  );
}

export function RateSimulator({ context }: { context: SimulatorContext }) {
  const [monthlyNet, setMonthlyNet] = useState(
    context.monthlyRevenueTarget
      ? Math.round(toEuros(context.monthlyRevenueTarget) * (1 - context.chargeRate) * 0.01) * 100
      : 3500,
  );
  const [daysPerMonth, setDaysPerMonth] = useState(
    context.actualDaysPerMonth > 0 ? context.actualDaysPerMonth : 15,
  );
  const [weeksOff, setWeeksOff] = useState(5);
  const [chargeRate, setChargeRate] = useState(Math.round(context.chargeRate * 1000) / 10);
  const [monthlyExpenses, setMonthlyExpenses] = useState(0);
  const [rate, setRate] = useState(
    context.actualRate > 0 ? Math.round(toEuros(context.actualRate)) : 500,
  );

  const input = useMemo(
    () => ({
      daysPerMonth,
      weeksOff,
      chargeRate: chargeRate / 100,
      monthlyExpenses: toCents(monthlyExpenses),
    }),
    [chargeRate, daysPerMonth, monthlyExpenses, weeksOff],
  );

  const requiredRate = rateFromNet(toCents(monthlyNet), input);
  const comparison = compareToActual(requiredRate, context.actualRate);
  const estimatedNet = netFromRate(toCents(rate), input);
  const projection = simulate(toCents(rate), input);
  const daysPerYear = billableDaysPerYear(input);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Hypothèses</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Slider
            id="days"
            label="Jours facturés par mois"
            value={daysPerMonth}
            min={1}
            max={22}
            step={0.5}
            suffix="j"
            onChange={setDaysPerMonth}
          />
          <Slider
            id="weeks-off"
            label="Semaines de congés par an"
            value={weeksOff}
            min={0}
            max={12}
            step={1}
            suffix="sem."
            onChange={setWeeksOff}
          />
          <Slider
            id="charge-rate"
            label="Taux de cotisations"
            value={chargeRate}
            min={0}
            max={50}
            step={0.1}
            suffix="%"
            onChange={setChargeRate}
          />
          <Slider
            id="expenses"
            label="Charges fixes mensuelles"
            value={monthlyExpenses}
            min={0}
            max={2000}
            step={50}
            suffix="€"
            onChange={setMonthlyExpenses}
          />
          <p className="text-muted-foreground text-xs md:col-span-2">
            Soit{" "}
            <strong>
              {daysPerYear.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} jours facturés par
              an
            </strong>
            . Le taux de cotisations vient des réglages ({(context.chargeRate * 100).toFixed(1)} %)
            et n&apos;est modifié ici que pour la simulation.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Objectif de revenu → TJM nécessaire</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <Slider
              id="net"
              label="Revenu net visé par mois"
              value={monthlyNet}
              min={500}
              max={15000}
              step={100}
              suffix="€"
              onChange={setMonthlyNet}
            />

            <div className="bg-muted flex items-center gap-3 rounded-lg p-4">
              <div>
                <p className="text-muted-foreground text-xs">Il vous faut un TJM de</p>
                <p className="tabular text-3xl font-semibold" data-testid="required-rate">
                  {formatMoneyShort(requiredRate)}
                </p>
              </div>
              <ArrowRight className="text-muted-foreground size-4 shrink-0" />
              <div>
                <p className="text-muted-foreground text-xs">pour un net mensuel de</p>
                <p className="tabular text-lg font-medium">
                  {formatMoneyShort(toCents(monthlyNet))}
                </p>
              </div>
            </div>

            {context.actualRate > 0 ? (
              <div className="flex items-start gap-2 text-sm">
                {comparison.gap > 0 ? (
                  <TrendingUp className="text-warning mt-0.5 size-4 shrink-0" />
                ) : (
                  <TrendingDown className="text-success mt-0.5 size-4 shrink-0" />
                )}
                <p>
                  Votre TJM moyen réel sur 12 mois est de{" "}
                  <strong className="tabular">{formatMoneyShort(context.actualRate)}</strong>.{" "}
                  {comparison.gap > 0 ? (
                    <>
                      Il manque{" "}
                      <strong className="tabular text-warning">
                        {formatMoneyShort(comparison.gap)}
                      </strong>{" "}
                      par jour
                      {comparison.gapRatio !== null
                        ? ` (+${Math.round(comparison.gapRatio * 100)} %)`
                        : ""}
                      .
                    </>
                  ) : (
                    <>
                      Vous êtes déjà{" "}
                      <strong className="tabular text-success">
                        {formatMoneyShort(-comparison.gap)}
                      </strong>{" "}
                      au-dessus de l&apos;objectif.
                    </>
                  )}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Aucun jour facturable saisi sur 12 mois : la comparaison au TJM réel apparaîtra dès
                les premières journées cochées.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>TJM → revenu estimé</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <Slider
              id="rate"
              label="TJM pratiqué"
              value={rate}
              min={100}
              max={2000}
              step={10}
              suffix="€"
              onChange={setRate}
            />

            <div className="bg-muted rounded-lg p-4">
              <p className="text-muted-foreground text-xs">Net estimé par mois</p>
              <p className="tabular text-3xl font-semibold" data-testid="estimated-net">
                {formatMoneyShort(estimatedNet)}
              </p>
            </div>

            <dl className="flex flex-col gap-2 text-sm">
              <Line label="CA annuel" value={formatMoney(projection.yearlyRevenue)} />
              <Line label="CA mensuel moyen" value={formatMoney(projection.monthlyRevenue)} />
              <Line
                label={`Cotisations (${chargeRate.toFixed(1)} %)`}
                value={`− ${formatMoney(projection.yearlyCharges)}`}
              />
              {monthlyExpenses > 0 ? (
                <Line
                  label="Charges fixes annuelles"
                  value={`− ${formatMoney(toCents(monthlyExpenses) * 12)}`}
                />
              ) : null}
              <Line label="Net annuel" value={formatMoney(projection.yearlyNet)} strong />
            </dl>
          </CardContent>
        </Card>
      </div>

      <p className="text-muted-foreground text-xs">
        Estimation indicative, hors impôt sur le revenu et hors CFE. Les chiffres officiels restent
        ceux d&apos;Indy.
      </p>
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`tabular ${strong ? "font-semibold" : ""}`}>{value}</dd>
    </div>
  );
}
