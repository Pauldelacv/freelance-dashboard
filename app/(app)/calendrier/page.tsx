import { PageHeader } from "@/components/layout/page-header";
import { CalendarBoard } from "@/components/calendar/calendar-board";
import { getMonthEntries } from "@/lib/queries/calendar";
import { listActiveClients } from "@/lib/queries/clients";
import { getSettings } from "@/lib/settings";
import { todayIso } from "@/lib/dates";

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

export default async function CalendrierPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const { year, month } = parseMonth(m);

  const [entries, clients, settings] = await Promise.all([
    getMonthEntries(year, month),
    listActiveClients(),
    getSettings(),
  ]);

  return (
    <>
      <PageHeader
        title="Calendrier"
        description="Un clic pose une journée pour le client actif. Maj+clic pour une demi-journée."
      />
      <CalendarBoard
        year={year}
        month={month}
        entries={entries}
        clients={clients}
        today={todayIso()}
        defaultFraction={settings.workday.defaultFraction}
      />
    </>
  );
}
