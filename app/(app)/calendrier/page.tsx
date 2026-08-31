import { PageHeader } from "@/components/layout/page-header";
import { CalendarBoard } from "@/components/calendar/calendar-board";
import { CalendarViewSwitch } from "@/components/calendar/view-switch";
import { GoalDialog } from "@/components/goals/goal-dialog";
import { YearHeatmap } from "@/components/calendar/year-heatmap";
import { getForfaitRevenue, getMonthEntries, getYearEntries } from "@/lib/queries/calendar";
import { listActiveClients } from "@/lib/queries/clients";
import { getYearGoals } from "@/lib/queries/goals";
import { getSettings } from "@/lib/settings";
import { formatMonthLabel, monthKey, todayIso } from "@/lib/dates";

export const metadata = { title: "Calendrier" };

/** "2026-08" dans l'URL, sinon le mois courant. */
function parseMonth(value: string | undefined): { year: number; month: number } {
  const today = todayIso();
  if (!value || !/^\d{4}-\d{2}$/.test(value)) {
    return { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  if (month < 1 || month > 12) {
    return { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
  }
  return { year, month };
}

/** "2026" dans l'URL, sinon l'année courante. */
function parseYear(value: string | undefined, fallback: number): number {
  if (!value || !/^\d{4}$/.test(value)) return fallback;
  return Number(value);
}

export default async function CalendrierPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; vue?: string; a?: string }>;
}) {
  const { m, vue, a } = await searchParams;
  const today = todayIso();
  const { year, month } = parseMonth(m);

  if (vue === "annee") {
    const displayedYear = parseYear(a, year);
    // Une seule lecture pour les 365 jours : la vue annuelle n'interroge jamais
    // la base mois par mois.
    const [entries, yearSettings, yearForfaits] = await Promise.all([
      getYearEntries(displayedYear),
      getSettings(),
      getForfaitRevenue(String(displayedYear)),
    ]);

    return (
      <>
        <PageHeader
          title="Calendrier"
          description="Vue annuelle : les creux et les périodes chargées d'un coup d'œil."
          action={
            <CalendarViewSwitch
              view="year"
              year={displayedYear}
              month={displayedYear === year ? month : 1}
            />
          }
        />
        <YearHeatmap
          year={displayedYear}
          entries={entries}
          today={today}
          chargeRate={yearSettings.tax.chargeRate}
          forfaitRevenue={yearForfaits}
        />
      </>
    );
  }

  const [entries, clients, settings, goals, forfaitRevenue] = await Promise.all([
    getMonthEntries(year, month),
    listActiveClients(),
    getSettings(),
    getYearGoals(year),
    getForfaitRevenue(monthKey(year, month)),
  ]);

  // Objectif du mois affiché, avec repli sur la valeur par défaut des réglages.
  const monthGoal = goals.byMonth[month] ?? null;
  const fallback = {
    revenueTarget: settings.goals.monthlyRevenue,
    daysTarget: settings.goals.monthlyDays,
  };

  return (
    <>
      <PageHeader
        title="Calendrier"
        description="Un clic pose une journée pour le client actif. Maj+clic pour une demi-journée."
        action={
          <>
            <GoalDialog
              year={year}
              month={month}
              monthLabel={formatMonthLabel(year, month)}
              goals={goals}
              fallback={fallback}
            />
            <CalendarViewSwitch view="month" year={year} month={month} />
          </>
        }
      />
      <CalendarBoard
        year={year}
        month={month}
        entries={entries}
        clients={clients}
        today={today}
        defaultFraction={settings.workday.defaultFraction}
        chargeRate={settings.tax.chargeRate}
        forfaitRevenue={forfaitRevenue}
        revenueTarget={monthGoal?.revenueTarget ?? fallback.revenueTarget}
        daysTarget={monthGoal?.daysTarget ?? fallback.daysTarget}
      />
    </>
  );
}
