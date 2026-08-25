"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import { formatMoney, formatMoneyShort } from "@/lib/money";
import {
  addMonths,
  daysInMonth,
  firstDayOfMonth,
  formatMonthLabel,
  isWeekend,
  isoWeekday,
  monthKey,
} from "@/lib/dates";
import { businessDaysInMonth, holidaysOfYear } from "@/lib/holidays";
import { DAY_TYPES, occupancyRate, totalRevenue, workedDays } from "@/lib/calculations/revenue";
import type { CalendarEntry } from "@/lib/queries/calendar";
import { setWorkDayRangeAction, toggleWorkDayAction } from "@/app/(app)/calendrier/actions";

const WEEKDAYS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];

const TYPE_LABELS: Record<string, string> = {
  billable: "Facturable",
  internal: "Interne",
  training: "Formation",
  off: "Congé",
};

const ACTIVE_CLIENT_KEY = "fd:active-client";

export interface CalendarClient {
  id: string;
  name: string;
  color: string;
  defaultRate: number;
}

interface OptimisticPatch {
  kind: "toggle" | "range";
  dates: string[];
  clientId: string;
  fraction: number;
  type: string;
  client: CalendarClient;
  clear: boolean;
}

function applyPatch(entries: CalendarEntry[], patch: OptimisticPatch): CalendarEntry[] {
  const targets = new Set(patch.dates);
  const kept = entries.filter(
    (entry) => !(targets.has(entry.date) && entry.clientId === patch.clientId),
  );
  if (patch.clear) return kept;

  const added: CalendarEntry[] = patch.dates.map((date) => ({
    id: `optimistic-${date}-${patch.clientId}`,
    date,
    clientId: patch.clientId,
    clientName: patch.client.name,
    color: patch.client.color,
    fraction: patch.fraction,
    rate: patch.client.defaultRate,
    type: patch.type,
    billing: "pending",
    note: null,
  }));
  return [...kept, ...added];
}

export function CalendarBoard({
  year,
  month,
  entries,
  clients,
  today,
  defaultFraction,
}: {
  year: number;
  month: number;
  entries: CalendarEntry[];
  clients: CalendarClient[];
  today: string;
  defaultFraction: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimisticEntries, addOptimistic] = useOptimistic(entries, applyPatch);

  const [activeClientId, setActiveClientId] = useState<string | null>(clients[0]?.id ?? null);
  const [fraction, setFraction] = useState<number>(defaultFraction);
  const [dayType, setDayType] = useState<string>("billable");
  const [drag, setDrag] = useState<{ from: string; to: string; clear: boolean } | null>(null);
  const dragRef = useRef<typeof drag>(null);

  // Le client actif est mémorisé d'une session à l'autre : on coche souvent
  // plusieurs jours de suite pour le même client.
  useEffect(() => {
    const stored = window.localStorage.getItem(ACTIVE_CLIENT_KEY);
    if (stored && clients.some((client) => client.id === stored)) setActiveClientId(stored);
  }, [clients]);

  useEffect(() => {
    if (activeClientId) window.localStorage.setItem(ACTIVE_CLIENT_KEY, activeClientId);
  }, [activeClientId]);

  const activeClient = clients.find((client) => client.id === activeClientId) ?? null;

  const entriesByDate = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const entry of optimisticEntries) {
      const list = map.get(entry.date);
      if (list) list.push(entry);
      else map.set(entry.date, [entry]);
    }
    return map;
  }, [optimisticEntries]);

  const holidays = useMemo(() => holidaysOfYear(year), [year]);
  const monthPrefix = monthKey(year, month);
  const totalDays = daysInMonth(year, month);
  const leading = isoWeekday(firstDayOfMonth(year, month)) - 1;

  const dates = useMemo(
    () =>
      Array.from(
        { length: totalDays },
        (_, index) => `${monthPrefix}-${String(index + 1).padStart(2, "0")}`,
      ),
    [monthPrefix, totalDays],
  );

  const goToMonth = useCallback(
    (delta: number) => {
      const target = addMonths(year, month, delta);
      router.push(`/calendrier?m=${monthKey(target.year, target.month)}`);
    },
    [month, router, year],
  );

  // Raccourcis clavier ← / → pour changer de mois.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "ArrowLeft") goToMonth(-1);
      if (event.key === "ArrowRight") goToMonth(1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goToMonth]);

  const entryFor = useCallback(
    (date: string) =>
      activeClientId
        ? (entriesByDate.get(date) ?? []).find((entry) => entry.clientId === activeClientId)
        : undefined,
    [activeClientId, entriesByDate],
  );

  const commitToggle = useCallback(
    (date: string, withFraction: number) => {
      if (!activeClient) return;
      const existing = entryFor(date);
      const clear = Boolean(
        existing && existing.fraction === withFraction && existing.type === dayType,
      );
      startTransition(async () => {
        addOptimistic({
          kind: "toggle",
          dates: [date],
          clientId: activeClient.id,
          fraction: withFraction,
          type: dayType,
          client: activeClient,
          clear,
        });
        await toggleWorkDayAction({
          date,
          clientId: activeClient.id,
          missionId: null,
          fraction: withFraction === 0.5 ? 0.5 : 1,
          type: dayType as (typeof DAY_TYPES)[number],
        });
      });
    },
    [activeClient, addOptimistic, dayType, entryFor],
  );

  const commitRange = useCallback(
    (rangeDates: string[], clear: boolean) => {
      if (!activeClient || rangeDates.length === 0) return;
      startTransition(async () => {
        addOptimistic({
          kind: "range",
          dates: rangeDates,
          clientId: activeClient.id,
          fraction,
          type: dayType,
          client: activeClient,
          clear,
        });
        await setWorkDayRangeAction({
          dates: rangeDates,
          clientId: activeClient.id,
          missionId: null,
          fraction: fraction === 0.5 ? 0.5 : 1,
          type: dayType as (typeof DAY_TYPES)[number],
          mode: clear ? "clear" : "set",
        });
      });
    },
    [activeClient, addOptimistic, dayType, fraction],
  );

  // Sélection par glissement : on retient l'ancre au pointerdown, on suit le
  // survol, et on applique tout au relâchement.
  useEffect(() => {
    dragRef.current = drag;
  }, [drag]);

  useEffect(() => {
    function onPointerUp() {
      const current = dragRef.current;
      setDrag(null);
      if (!current) return;
      const [from, to] = [current.from, current.to].sort();
      if (from === to) return; // simple clic : géré par onClick
      const selected = dates.filter((date) => date >= from && date <= to);
      commitRange(selected, current.clear);
    }
    window.addEventListener("pointerup", onPointerUp);
    return () => window.removeEventListener("pointerup", onPointerUp);
  }, [commitRange, dates]);

  const dragSelection = useMemo(() => {
    if (!drag) return new Set<string>();
    const [from, to] = [drag.from, drag.to].sort();
    return new Set(dates.filter((date) => date >= from && date <= to));
  }, [dates, drag]);

  const monthEntries = optimisticEntries;
  const revenue = totalRevenue(monthEntries);
  const worked = workedDays(monthEntries);
  const businessDays = businessDaysInMonth(year, month);
  const occupancy = occupancyRate(monthEntries, businessDays);

  const perClient = useMemo(() => {
    const map = new Map<string, { name: string; color: string; days: number; revenue: number }>();
    for (const entry of monthEntries) {
      if (!entry.clientId) continue;
      const current = map.get(entry.clientId) ?? {
        name: entry.clientName ?? "—",
        color: entry.color ?? "#94a3b8",
        days: 0,
        revenue: 0,
      };
      current.days += entry.fraction;
      if (entry.type === "billable") current.revenue += Math.round(entry.rate * entry.fraction);
      map.set(entry.clientId, current);
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue);
  }, [monthEntries]);

  if (clients.length === 0) {
    return (
      <Card className="text-muted-foreground p-8 text-sm">
        Créez d&apos;abord un client avec son TJM : le calendrier a besoin de savoir à qui rattacher
        vos journées.
      </Card>
    );
  }

  // Cases vides de fin de mois : sans elles, la dernière ligne de la grille
  // s'arrête au milieu et le filet vertical reste en suspens.
  const trailing = (7 - ((leading + totalDays) % 7)) % 7;

  const controlClass = "border-input bg-card h-8 rounded-(--radius-control) border px-2 text-sm";

  return (
    <div className="flex flex-col gap-3">
      <Card className="flex flex-wrap items-center gap-x-3 gap-y-2 p-2">
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Mois précédent"
            onClick={() => goToMonth(-1)}
          >
            <ChevronLeft />
          </Button>
          <span className="min-w-36 text-center text-sm font-medium capitalize">
            {formatMonthLabel(year, month)}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Mois suivant"
            onClick={() => goToMonth(1)}
          >
            <ChevronRight />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => router.push("/calendrier")}>
            Aujourd&apos;hui
          </Button>
          {pending ? (
            <Loader2 className="text-muted-foreground ml-1 size-3.5 animate-spin" />
          ) : null}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* La pastille rappelle à qui les prochains clics seront rattachés :
              c'est l'erreur la plus facile à commettre sur cet écran. */}
          <span className="border-input bg-card flex h-8 items-center gap-2 rounded-(--radius-control) border pr-2 pl-2">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: activeClient?.color ?? "var(--muted-foreground)" }}
            />
            <select
              aria-label="Client actif"
              value={activeClientId ?? ""}
              onChange={(event) => setActiveClientId(event.target.value)}
              className="bg-card -mr-1 text-sm outline-none"
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </span>

          <div className="border-input flex h-8 overflow-hidden rounded-(--radius-control) border">
            {[1, 0.5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFraction(value)}
                aria-pressed={fraction === value}
                className={cn(
                  "px-2.5 text-xs transition-colors",
                  fraction === value
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {value === 1 ? "Journée" : "½ journée"}
              </button>
            ))}
          </div>

          <select
            aria-label="Type de journée"
            value={dayType}
            onChange={(event) => setDayType(event.target.value)}
            className={controlClass}
          >
            {DAY_TYPES.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* La grille est un seul objet : le fond porte les filets (`gap-px` sur un
          fond de bordure) et chaque case repose dessus. Trente-cinq cartes
          bordées séparément produisaient trente-cinq rectangles concurrents. */}
      <Card className="overflow-hidden">
        <div className="border-border grid grid-cols-7 border-b">
          {WEEKDAYS.map((label) => (
            <div key={label} className="metric-label py-2 text-center">
              {label}
            </div>
          ))}
        </div>

        <div className="bg-border grid grid-cols-7 gap-px">
          {Array.from({ length: leading }, (_, index) => (
            <div key={`blank-${index}`} className="bg-muted/20 min-h-16" />
          ))}

          {dates.map((date) => {
            const dayEntries = entriesByDate.get(date) ?? [];
            const holiday = holidays.get(date);
            const weekend = isWeekend(date);
            const isToday = date === today;
            const selected = dragSelection.has(date);
            const dayRevenue = dayEntries
              .filter((entry) => entry.type === "billable")
              .reduce((sum, entry) => sum + Math.round(entry.rate * entry.fraction), 0);

            return (
              <button
                key={date}
                type="button"
                data-date={date}
                aria-label={`${Number(date.slice(8, 10))} ${formatMonthLabel(year, month)}`}
                onPointerDown={() => {
                  const existing = entryFor(date);
                  setDrag({ from: date, to: date, clear: Boolean(existing) });
                }}
                onPointerEnter={() => {
                  setDrag((current) => (current ? { ...current, to: date } : null));
                }}
                onClick={(event) => commitToggle(date, event.shiftKey ? 0.5 : fraction)}
                title={
                  [
                    holiday,
                    ...dayEntries.map(
                      (entry) =>
                        `${entry.clientName ?? "Sans client"} · ${entry.fraction === 0.5 ? "½ j" : "1 j"}${
                          entry.type === "billable"
                            ? ` · ${formatMoney(Math.round(entry.rate * entry.fraction))}`
                            : ` · ${TYPE_LABELS[entry.type]}`
                        }`,
                    ),
                  ]
                    .filter(Boolean)
                    .join("\n") || undefined
                }
                className={cn(
                  "relative flex min-h-16 flex-col gap-1 p-1.5 text-left transition-colors select-none",
                  weekend || holiday ? "bg-muted/50" : "bg-card",
                  selected ? "bg-accent ring-ring z-10 ring-1 ring-inset" : "hover:bg-muted/40",
                )}
              >
                <span className="flex items-center gap-1">
                  {/* Aujourd'hui : une pastille pleine plutôt qu'une bordure de
                      case — la bordure entrait en concurrence avec celle de la
                      sélection, on ne distinguait plus les deux états. */}
                  <span
                    className={cn(
                      "tabular flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-xs",
                      isToday
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-muted-foreground",
                    )}
                  >
                    {Number(date.slice(8, 10))}
                  </span>
                  {holiday ? (
                    <span className="text-subtle-foreground truncate text-[10px]">{holiday}</span>
                  ) : null}
                </span>

                <span className="flex flex-1 flex-col justify-end gap-0.5">
                  {dayEntries.map((entry) => {
                    const color = entry.color ?? "var(--muted-foreground)";
                    return (
                      <span
                        key={entry.id}
                        className={cn(
                          "flex min-h-4 items-stretch gap-1 overflow-hidden rounded-[3px]",
                          entry.type !== "billable" && "opacity-70",
                        )}
                        style={{
                          // Fond teinté + filet de couleur : le nom du client
                          // reste lu en encre normale, là où l'aplat saturé
                          // imposait du blanc sur huit teintes de luminosité
                          // très différentes.
                          backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)`,
                          width: entry.fraction === 0.5 ? "62%" : "100%",
                        }}
                      >
                        <span
                          aria-hidden
                          className="w-0.5 shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="truncate py-px pr-1 text-[10px] font-medium">
                          {entry.fraction === 0.5 ? "½ " : ""}
                          {/* Sur téléphone la case est trop étroite pour un nom :
                              la couleur et le montant suffisent. */}
                          <span className="hidden sm:inline">{entry.clientName ?? "—"}</span>
                        </span>
                      </span>
                    );
                  })}
                </span>

                {dayRevenue > 0 ? (
                  <span className="tabular text-muted-foreground text-right text-[10px]">
                    {formatMoneyShort(dayRevenue)}
                  </span>
                ) : null}
              </button>
            );
          })}

          {Array.from({ length: trailing }, (_, index) => (
            <div key={`trailing-${index}`} className="bg-muted/20 min-h-16" />
          ))}
        </div>
      </Card>

      <Card>
        <div className="divide-border border-border grid grid-cols-2 gap-px divide-x-0 sm:grid-cols-3 sm:divide-x">
          <Total
            label="Jours travaillés"
            value={worked.toLocaleString("fr-FR")}
            testId="total-days"
          />
          <Total label="CA du mois" value={formatMoney(revenue)} testId="total-revenue" />
          <Total
            label="Taux d'occupation"
            value={`${Math.round(occupancy * 100)} %`}
            hint={`sur ${businessDays} jours ouvrés`}
            testId="total-occupancy"
          />
        </div>

        {perClient.length > 0 ? (
          <div className="border-border flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t px-4 py-2.5">
            {perClient.map((client) => (
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

      <p className="text-subtle-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="flex items-center gap-1">
          <Kbd>Clic</Kbd> {fraction === 0.5 ? "demi-journée" : "journée"}
        </span>
        <span className="flex items-center gap-1">
          <Kbd>Maj</Kbd>+<Kbd>Clic</Kbd> demi-journée
        </span>
        <span className="flex items-center gap-1">
          <Kbd>Clic-glissé</Kbd> plage de jours
        </span>
        <span className="flex items-center gap-1">
          <Kbd>←</Kbd>
          <Kbd>→</Kbd> mois précédent / suivant
        </span>
      </p>
    </div>
  );
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
