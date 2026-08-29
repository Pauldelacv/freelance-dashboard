import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CircleAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { GoalDialog } from "@/components/goals/goal-dialog";
import { Metric, MetricRow } from "@/components/dashboard/metric";
import { RevenueBars } from "@/components/dashboard/revenue-bars";
import { CashFlowBar } from "@/components/dashboard/cash-flow-bar";
import { Card, CardBar, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDashboardSummary } from "@/lib/queries/dashboard";
import { getYearGoals } from "@/lib/queries/goals";
import { getSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { formatMoney, formatMoneyShort } from "@/lib/money";
import { formatMonthLabel, todayIso } from "@/lib/dates";

export default async function DashboardPage() {
  const year = Number(todayIso().slice(0, 4));
  const [summary, goals, settings] = await Promise.all([
    getDashboardSummary(),
    getYearGoals(year),
    getSettings(),
  ]);
  const monthLabel = formatMonthLabel(summary.year, summary.month);

  // La jauge suit l'objectif du mois affiché ; les réglages ne fournissent que
  // le repli quand ce mois n'a pas le sien.
  const goalDialog = (trigger: React.ReactNode) => (
    <GoalDialog
      year={summary.year}
      month={summary.month}
      monthLabel={monthLabel}
      goals={goals}
      fallback={{
        revenueTarget: settings.goals.monthlyRevenue,
        daysTarget: settings.goals.monthlyDays,
      }}
      trigger={trigger}
    />
  );

  // `last12Months` va du plus ancien au mois en cours : l'avant-dernier point
  // est donc le mois précédent.
  const previous = summary.last12Months.at(-2);
  const delta = monthDelta(summary.monthRevenue, previous?.revenue ?? 0);

  const target = summary.revenueTarget;
  const targetRatio = target ? summary.monthRevenue / target : null;

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        description={monthLabel}
        action={
          <Link
            href="/calendrier"
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors"
          >
            Cocher mes journées
            <ArrowRight className="size-3.5" />
          </Link>
        }
      />

      {/* Le mois en cours comme un seul objet : le chiffre qu'on vient lire, son
          historique qui lui donne une échelle, et ses constantes vitales. */}
      <Card>
        <div className="grid grid-cols-1 gap-6 p-4 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-7">
          <div className="flex flex-col justify-between gap-4">
            <div>
              <p className="metric-label">CA facturable du mois</p>
              <p className="tabular mt-1 text-3xl font-semibold">
                {formatMoney(summary.monthRevenue)}
              </p>
              {delta ? (
                <p className="text-muted-foreground mt-1.5 flex items-center gap-1 text-xs">
                  {delta.up ? (
                    <ArrowUpRight className="size-3.5" />
                  ) : (
                    <ArrowDownRight className="size-3.5" />
                  )}
                  <span className="tabular">{delta.label}</span>
                  <span className="text-subtle-foreground">vs {previous?.label}</span>
                </p>
              ) : (
                <p className="text-subtle-foreground mt-1.5 text-xs">Pas de CA le mois précédent</p>
              )}
            </div>

            {target && targetRatio !== null ? (
              <div>
                <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">Objectif {formatMoneyShort(target)}</span>
                  <span className="tabular font-medium">{Math.round(targetRatio * 100)} %</span>
                </div>
                <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full rounded-full"
                    style={{ width: `${Math.min(100, Math.max(0, targetRatio * 100))}%` }}
                  />
                </div>
                <p className="text-subtle-foreground mt-1.5 text-xs">
                  {summary.monthRevenue >= target
                    ? "Objectif atteint."
                    : `Reste ${formatMoney(target - summary.monthRevenue)} à faire.`}{" "}
                  {goalDialog(
                    <button
                      type="button"
                      className="hover:text-foreground underline-offset-4 hover:underline"
                    >
                      Modifier
                    </button>,
                  )}
                </p>
              </div>
            ) : (
              <p className="text-subtle-foreground text-xs">
                Aucun objectif pour {monthLabel} —{" "}
                {goalDialog(
                  <button type="button" className="text-primary hover:underline">
                    en définir un
                  </button>,
                )}
              </p>
            )}
          </div>

          <RevenueBars points={summary.last12Months} />
        </div>

        <MetricRow>
          <Metric
            label="Jours travaillés"
            value={summary.monthWorkedDays.toLocaleString("fr-FR")}
            hint={
              summary.daysTarget
                ? `Objectif ${summary.daysTarget.toLocaleString("fr-FR")} j`
                : `${summary.monthBusinessDays} jours ouvrés`
            }
          />
          <Metric
            label="Taux d'occupation"
            value={`${Math.round(summary.occupancy * 100)} %`}
            hint={`sur ${summary.monthBusinessDays} jours ouvrés`}
          />
          <Metric
            label="TJM moyen réel"
            value={summary.averageRate ? formatMoneyShort(summary.averageRate) : "—"}
            hint="12 mois glissants"
          />
          <Metric
            label="Clients actifs"
            value={summary.clientCount.toLocaleString("fr-FR")}
            hint={`${summary.monthBillableDays.toLocaleString("fr-FR")} j facturables ce mois`}
          />
          <Metric
            label="Pipeline pondéré"
            value={formatMoneyShort(summary.pipelineValue)}
            hint="prospects ouverts"
          />
        </MetricRow>
      </Card>

      <section className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardBar>
            <CardTitle>Ce qui doit encore rentrer</CardTitle>
            <Link
              href="/tresorerie"
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
            >
              Prévisionnel
              <ArrowRight className="size-3" />
            </Link>
          </CardBar>
          <CardContent className="pt-4">
            <CashFlowBar
              segments={[
                {
                  label: "À facturer",
                  amount: summary.toInvoice,
                  color: "bg-warning",
                  hint: "Jours cochés, pas encore de facture dans Indy",
                },
                {
                  label: "Facturé, non encaissé",
                  amount: summary.awaitingPayment,
                  color: "bg-primary",
                  hint: "Facture émise, en attente de paiement",
                },
              ]}
            />
          </CardContent>
          <div className="border-border text-muted-foreground flex items-baseline justify-between gap-3 border-t px-4 py-2.5 text-xs">
            <span>Encaissé depuis le 1ᵉʳ janvier</span>
            <span
              className={cn(
                "tabular font-medium",
                summary.collectedThisYear > 0 ? "text-success" : "text-muted-foreground",
              )}
            >
              {formatMoney(summary.collectedThisYear)}
            </span>
          </div>
        </Card>

        <Card>
          <CardBar>
            <CardTitle>Prospects à relancer</CardTitle>
            <Link
              href="/prospects"
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
            >
              Pipeline
              <ArrowRight className="size-3" />
            </Link>
          </CardBar>

          {summary.dueProspects.length === 0 ? (
            <CardContent className="pt-4">
              <p className="text-muted-foreground text-sm">Aucune relance en attente.</p>
              <p className="text-subtle-foreground mt-1 text-xs">
                Les prospects dont la date de prochaine action est passée apparaissent ici.
              </p>
            </CardContent>
          ) : (
            <ul className="divide-border divide-y">
              {summary.dueProspects.map((prospect) => (
                <li key={prospect.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{prospect.name}</p>
                      {prospect.late ? (
                        <Badge variant="warning">
                          <CircleAlert className="size-3" />
                          En retard
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-subtle-foreground truncate text-xs">
                      {prospect.nextAction ?? "Relance prévue"}
                      {prospect.nextActionAt ? ` · ${prospect.nextActionAt}` : ""}
                      {prospect.company ? ` · ${prospect.company}` : ""}
                    </p>
                  </div>
                  <span
                    className="tabular text-muted-foreground shrink-0 text-sm"
                    title="Valeur pondérée par la probabilité"
                  >
                    {formatMoneyShort(prospect.weighted)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </>
  );
}

/**
 * Écart avec le mois précédent. `null` quand le mois précédent est à zéro :
 * une variation en pourcentage depuis zéro n'a pas de sens, et afficher
 * « +100 % » ou « +∞ » induirait en erreur.
 */
function monthDelta(current: number, previous: number): { up: boolean; label: string } | null {
  if (previous <= 0) return null;
  const ratio = (current - previous) / previous;
  const percent = Math.round(Math.abs(ratio) * 100);
  return { up: ratio >= 0, label: `${ratio >= 0 ? "+" : "−"}${percent} %` };
}
