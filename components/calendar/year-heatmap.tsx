import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatMoney, formatMoneyShort } from "@/lib/money";
import {
  daysInMonth,
  firstDayOfMonth,
  formatLongDate,
  formatMonthName,
  isWeekend,
  isoWeekday,
  monthKey,
} from "@/lib/dates";
import { businessDaysInYear, holidaysOfYear } from "@/lib/holidays";
import { billableDays, occupancyRate, totalRevenue, workedDays } from "@/lib/calculations/revenue";
import type { CalendarEntry } from "@/lib/queries/calendar";

const WEEKDAYS = ["l", "m", "m", "j", "v", "s", "d"];

const TYPE_LABELS: Record<string, string> = {
  billable: "Facturable",
  internal: "Interne",
  training: "Formation",
  off: "Congé",
};

/** Couleur des journées sans client identifiable (congé, jour orphelin). */
const NEUTRAL = "var(--muted-foreground)";

interface DaySummary {
  fraction: number;
  revenue: number;
  /** Couleur du client qui occupe la plus grande part de la journée. */
  color: string;
  /** Journée entièrement en congé : elle ne se lit pas comme du travail. */
  offOnly: boolean;
  title: string;
}

function summarize(
  date: string,
  entries: CalendarEntry[],
  holiday: string | undefined,
): DaySummary {
  let fraction = 0;
  let revenue = 0;
  const shares = new Map<string, number>();

  for (const entry of entries) {
    fraction += entry.fraction;
    if (entry.type === "billable") revenue += Math.round(entry.rate * entry.fraction);
    const color = entry.color ?? NEUTRAL;
    shares.set(color, (shares.get(color) ?? 0) + entry.fraction);
  }

  const [dominant] = [...shares.entries()].sort((a, b) => b[1] - a[1])[0] ?? [NEUTRAL];

  return {
    fraction,
    revenue,
    color: dominant,
    offOnly: entries.length > 0 && entries.every((entry) => entry.type === "off"),
    title: [
      formatLongDate(date),
      holiday,
      ...entries.map(
        (entry) =>
          `${entry.clientName ?? "Sans client"} · ${entry.fraction === 0.5 ? "½ j" : `${entry.fraction.toLocaleString("fr-FR")} j`}` +
          (entry.type === "billable"
            ? ` · ${formatMoney(Math.round(entry.rate * entry.fraction))}`
            : ` · ${TYPE_LABELS[entry.type] ?? entry.type}`),
      ),
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

/**
 * Vue annuelle en lecture seule — douze mois côte à côte, une case par jour.
 *
 * La saisie reste dans la vue mensuelle : ici on cherche les creux et les
 * périodes chargées, pas à cocher. Une case n'est donc pas un bouton.
 *
 * Encodage des couleurs : la teinte dit **qui**, l'intensité dit **combien**.
 * Une heatmap classique n'aurait qu'une seule teinte du clair au foncé, mais la
 * magnitude utile ici (journée ou demi-journée) ne compte que deux paliers,
 * alors que la question « pour quel client ? » se pose à chaque case. La palette
 * catégorielle garde donc son rôle, à opacité pleine, et le palier clair est
 * réservé aux demi-journées.
 */
export function YearHeatmap({
  year,
  entries,
  today,
}: {
  year: number;
  entries: CalendarEntry[];
  today: string;
}) {
  const holidays = holidaysOfYear(year);

  const byDate = new Map<string, CalendarEntry[]>();
  for (const entry of entries) {
    const list = byDate.get(entry.date);
    if (list) list.push(entry);
    else byDate.set(entry.date, [entry]);
  }

  const businessDays = businessDaysInYear(year);
  const revenue = totalRevenue(entries);
  const worked = workedDays(entries);
  const billable = billableDays(entries);
  const occupancy = occupancyRate(entries, businessDays);

  const perClient = new Map<
    string,
    { name: string; color: string; days: number; revenue: number }
  >();
  for (const entry of entries) {
    const key = entry.clientId ?? "";
    const current = perClient.get(key) ?? {
      name: entry.clientName ?? "Sans client",
      color: entry.color ?? NEUTRAL,
      days: 0,
      revenue: 0,
    };
    current.days += entry.fraction;
    if (entry.type === "billable") current.revenue += Math.round(entry.rate * entry.fraction);
    perClient.set(key, current);
  }
  const clients = [...perClient.values()].sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="flex flex-col gap-3">
      <Card className="flex flex-wrap items-center gap-x-3 gap-y-2 p-2">
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon-sm" aria-label="Année précédente" asChild>
            <Link href={`/calendrier?vue=annee&a=${year - 1}`}>
              <ChevronLeft />
            </Link>
          </Button>
          <span className="tabular min-w-16 text-center text-sm font-medium">{year}</span>
          <Button variant="ghost" size="icon-sm" aria-label="Année suivante" asChild>
            <Link href={`/calendrier?vue=annee&a=${year + 1}`}>
              <ChevronRight />
            </Link>
          </Button>
        </div>

        <p className="text-subtle-foreground ml-auto text-xs">
          Lecture seule — la saisie se fait dans la vue mensuelle.
        </p>
      </Card>

      <Card className="p-4">
        <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 12 }, (_, index) => (
            <MonthBlock
              key={index + 1}
              year={year}
              month={index + 1}
              byDate={byDate}
              holidays={holidays}
              today={today}
            />
          ))}
        </div>

        <div className="text-subtle-foreground mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
          <span className="flex items-center gap-1.5">
            <Swatch style={{ backgroundColor: "var(--muted)" }} />
            Aucun jour
          </span>
          <span className="flex items-center gap-1.5">
            <Swatch
              style={{ backgroundColor: `color-mix(in oklab, ${NEUTRAL} 45%, var(--card))` }}
            />
            Demi-journée
          </span>
          <span className="flex items-center gap-1.5">
            <Swatch style={{ backgroundColor: NEUTRAL }} />
            Journée
          </span>
          <span>La teinte est celle du client, grisée pour les congés.</span>
        </div>
      </Card>

      <Card>
        <div className="divide-border border-border grid grid-cols-2 gap-px divide-x-0 sm:grid-cols-4 sm:divide-x">
          <Total label="Jours travaillés" value={worked.toLocaleString("fr-FR")} />
          <Total
            label="Jours facturables"
            value={billable.toLocaleString("fr-FR")}
            testId="year-billable-days"
          />
          <Total label="CA de l'année" value={formatMoney(revenue)} testId="year-revenue" />
          <Total
            label="Taux d'occupation"
            value={`${Math.round(occupancy * 100)} %`}
            hint={`sur ${businessDays} jours ouvrés`}
          />
        </div>

        {clients.length > 0 ? (
          <div className="border-border flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t px-4 py-2.5">
            {clients.map((client) => (
              <span key={client.name} className="flex items-center gap-1.5 text-xs">
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: client.color }}
                />
                {client.name}
                <span className="tabular text-muted-foreground">
                  {client.days.toLocaleString("fr-FR")} j · {formatMoneyShort(client.revenue)}
                </span>
              </span>
            ))}
          </div>
        ) : null}
      </Card>
    </div>
  );
}

/**
 * Un mois de la grille annuelle.
 *
 * Les cases sont `aria-hidden` : 365 pastilles annoncées une à une ne
 * renseignent personne. Le total du mois, lui, est écrit à côté du nom du mois
 * — c'est l'information que la couleur donne à l'œil.
 */
function MonthBlock({
  year,
  month,
  byDate,
  holidays,
  today,
}: {
  year: number;
  month: number;
  byDate: Map<string, CalendarEntry[]>;
  holidays: Map<string, string>;
  today: string;
}) {
  const prefix = monthKey(year, month);
  const total = daysInMonth(year, month);
  const leading = isoWeekday(firstDayOfMonth(year, month)) - 1;
  const dates = Array.from(
    { length: total },
    (_, index) => `${prefix}-${String(index + 1).padStart(2, "0")}`,
  );

  const monthEntries = dates.flatMap((date) => byDate.get(date) ?? []);
  const monthDays = workedDays(monthEntries);
  const monthRevenue = totalRevenue(monthEntries);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <Link
          href={`/calendrier?m=${prefix}`}
          className="text-sm font-medium capitalize hover:underline"
        >
          {formatMonthName(year, month)}
        </Link>
        <span className="tabular text-subtle-foreground text-xs">
          {monthDays > 0
            ? `${monthDays.toLocaleString("fr-FR")} j · ${formatMoneyShort(monthRevenue)}`
            : "—"}
        </span>
      </div>

      <div aria-hidden className="mt-1.5 grid grid-cols-7 gap-[3px]">
        {WEEKDAYS.map((label, index) => (
          <span
            key={index}
            className="text-subtle-foreground text-center text-[10px] leading-none lowercase"
          >
            {label}
          </span>
        ))}

        {Array.from({ length: leading }, (_, index) => (
          <span key={`blank-${index}`} />
        ))}

        {dates.map((date) => {
          const entries = byDate.get(date) ?? [];
          const holiday = holidays.get(date);
          const day = summarize(date, entries, holiday);
          const empty = entries.length === 0;
          const color = day.offOnly ? NEUTRAL : day.color;

          return (
            <span
              key={date}
              title={day.title}
              className={cn(
                "aspect-square rounded-[2px]",
                date === today && "ring-foreground/70 ring-1",
              )}
              style={{
                backgroundColor: empty
                  ? isWeekend(date) || holiday
                    ? "color-mix(in oklab, var(--muted) 45%, var(--card))"
                    : "var(--muted)"
                  : day.fraction >= 1
                    ? color
                    : `color-mix(in oklab, ${color} 45%, var(--card))`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function Swatch({ style }: { style: React.CSSProperties }) {
  return <span aria-hidden className="size-2.5 rounded-[2px]" style={style} />;
}

function Total({
  label,
  value,
  hint,
  testId,
}: {
  label: string;
  value: string;
  hint?: string;
  testId?: string;
}) {
  return (
    <div className="px-4 py-3">
      <p className="metric-label">{label}</p>
      <p className="tabular mt-1 text-lg font-semibold" data-testid={testId}>
        {value}
      </p>
      {hint ? <p className="text-subtle-foreground mt-0.5 text-xs">{hint}</p> : null}
    </div>
  );
}
