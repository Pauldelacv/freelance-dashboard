import Link from "next/link";
import {
  AlertCircle,
  CalendarCheck,
  Euro,
  Gauge,
  PiggyBank,
  Receipt,
  TrendingUp,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardSummary } from "@/lib/queries/dashboard";
import { formatMoney, formatMoneyShort } from "@/lib/money";
import { formatMonthLabel } from "@/lib/dates";

export default async function DashboardPage() {
  const summary = await getDashboardSummary();
  const monthLabel = formatMonthLabel(summary.year, summary.month);
  const percent = (value: number) => `${Math.round(value * 100)} %`;

  return (
    <>
      <PageHeader title="Tableau de bord" description={`Vue d'ensemble — ${monthLabel}`} />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <KpiTile
          label="CA du mois"
          value={formatMoneyShort(summary.monthRevenue)}
          hint={
            summary.revenueTarget
              ? `Objectif ${formatMoneyShort(summary.revenueTarget)}`
              : "Aucun objectif défini"
          }
          progress={summary.revenueTarget ? summary.monthRevenue / summary.revenueTarget : null}
          icon={Euro}
        />
        <KpiTile
          label="Jours travaillés"
          value={summary.monthWorkedDays.toLocaleString("fr-FR")}
          hint={
            summary.daysTarget
              ? `Objectif ${summary.daysTarget} j`
              : `${summary.monthBusinessDays} jours ouvrés`
          }
          progress={summary.daysTarget ? summary.monthWorkedDays / summary.daysTarget : null}
          icon={CalendarCheck}
        />
        <KpiTile
          label="Taux d'occupation"
          value={percent(summary.occupancy)}
          hint={`${summary.monthWorkedDays.toLocaleString("fr-FR")} / ${summary.monthBusinessDays} jours ouvrés`}
          icon={Gauge}
        />
        <KpiTile
          label="TJM moyen réel"
          value={summary.averageRate ? formatMoneyShort(summary.averageRate) : "—"}
          hint="Sur 12 mois glissants"
          icon={TrendingUp}
        />
        <KpiTile
          label="À facturer"
          value={formatMoneyShort(summary.toInvoice)}
          hint="Jours cochés, pas encore dans Indy"
          icon={Receipt}
          tone="warning"
        />
        <KpiTile
          label="En attente de paiement"
          value={formatMoneyShort(summary.awaitingPayment)}
          hint={`Encaissé cette année : ${formatMoneyShort(summary.collectedThisYear)}`}
          icon={PiggyBank}
          tone="success"
        />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>CA des 12 derniers mois</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyBars points={summary.last12Months} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Repères</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <Row label="Clients actifs" value={String(summary.clientCount)} />
            <Row label="Pipeline pondéré" value={formatMoney(summary.pipelineValue)} />
            <Row
              label="Jours facturables ce mois"
              value={summary.monthBillableDays.toLocaleString("fr-FR")}
            />
            <Row label="CA du mois" value={formatMoney(summary.monthRevenue)} />
            <Row label="À facturer" value={formatMoney(summary.toInvoice)} />
            <Row label="Facturé non encaissé" value={formatMoney(summary.awaitingPayment)} />
          </CardContent>
        </Card>
      </section>

      {summary.dueProspects.length > 0 ? (
        <section className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Prospects à relancer</CardTitle>
            </CardHeader>
            <CardContent className="divide-border flex flex-col divide-y">
              {summary.dueProspects.map((prospect) => (
                <div
                  key={prospect.id}
                  className="flex flex-wrap items-center gap-3 py-2 first:pt-0 last:pb-0"
                >
                  <AlertCircle
                    className={`size-4 shrink-0 ${prospect.late ? "text-warning" : "text-muted-foreground"}`}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{prospect.name}</p>
                    {prospect.company ? (
                      <p className="text-muted-foreground truncate text-xs">{prospect.company}</p>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {prospect.nextAction ?? "Relance prévue"}
                    {prospect.nextActionAt ? ` · ${prospect.nextActionAt}` : ""}
                  </p>
                  <span className="tabular ml-auto text-sm">
                    {formatMoneyShort(prospect.weighted)} pondérés
                  </span>
                </div>
              ))}
              <div className="pt-3">
                <Link href="/prospects" className="text-primary text-sm hover:underline">
                  Ouvrir le pipeline →
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>
      ) : null}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular font-medium">{value}</span>
    </div>
  );
}

/**
 * Mini-graphique en barres rendu côté serveur : ce bandeau n'a pas besoin
 * d'interaction, on évite d'embarquer Recharts (réservé à la trésorerie).
 */
function MonthlyBars({ points }: { points: { key: string; label: string; revenue: number }[] }) {
  const max = Math.max(...points.map((point) => point.revenue), 1);

  return (
    <div className="flex h-40 gap-1.5">
      {points.map((point) => (
        <div key={point.key} className="flex flex-1 flex-col gap-1.5">
          {/* Conteneur à hauteur définie : sans lui, la hauteur en % de la barre
              se résoudrait contre une hauteur automatique, donc zéro. */}
          <div className="relative flex-1">
            <div
              className="bg-primary/80 absolute bottom-0 w-full rounded-t"
              style={{
                height: `${point.revenue === 0 ? 2 : Math.max(4, (point.revenue / max) * 100)}%`,
              }}
              title={`${point.label} : ${formatMoney(point.revenue)}`}
            />
          </div>
          <span className="text-muted-foreground text-center text-[10px]">{point.label}</span>
        </div>
      ))}
    </div>
  );
}
