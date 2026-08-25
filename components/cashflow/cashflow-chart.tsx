"use client";

import { useMemo, useState } from "react";
import { useTheme } from "next-themes";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatMoney, formatMoneyShort } from "@/lib/money";
import { formatWeekLabel } from "@/lib/dates";
import { seriesColor } from "@/lib/colors";
import type { CashflowData } from "@/lib/queries/cashflow";

type Mode = "client" | "certainty";

interface Row {
  week: string;
  label: string;
  certain: number;
  probable: number;
  pipeline: number;
  total: number;
  byClient: Record<string, number>;
  details: { name: string; color: string; amount: number }[];
}

export function CashflowChart({ data }: { data: CashflowData }) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const [mode, setMode] = useState<Mode>("certainty");
  const [withPipeline, setWithPipeline] = useState(false);

  const rows: Row[] = useMemo(
    () =>
      data.weeks.map((week, index) => {
        const byClient: Record<string, number> = {};
        for (const entry of week.byClient) byClient[entry.clientId] = entry.amount;
        const pipeline = withPipeline ? (data.pipelineWeeks[index]?.pipeline ?? 0) : 0;
        return {
          week: week.weekStart,
          label: formatWeekLabel(week.weekStart),
          certain: week.certain,
          probable: week.probable,
          pipeline,
          total: week.certain + week.probable + pipeline,
          byClient,
          details: week.byClient.map((entry) => ({
            name: entry.name,
            color: entry.color,
            amount: entry.amount,
          })),
        };
      }),
    [data.pipelineWeeks, data.weeks, withPipeline],
  );

  const hasData = rows.some((row) => row.total > 0);
  const gridColor = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
  const axisColor = dark ? "#8b8f9a" : "#6b7280";
  const surface = dark ? "#242730" : "#ffffff";

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Encaissements attendus sur 12 semaines</CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">
            Déduits des jours travaillés et du délai de paiement de chaque client.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="border-input flex overflow-hidden rounded-lg border">
            {(
              [
                ["certainty", "Par certitude"],
                ["client", "Par client"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                aria-pressed={mode === value}
                className={cn(
                  "px-3 py-1.5 text-xs transition-colors",
                  mode === value ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Button
            variant={withPipeline ? "default" : "outline"}
            size="sm"
            onClick={() => setWithPipeline((value) => !value)}
          >
            Pipeline pondéré
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {!hasData ? (
          <p className="text-muted-foreground py-12 text-center text-sm">
            Aucun encaissement attendu : cochez des jours facturables dans le calendrier.
          </p>
        ) : (
          <>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                  <defs>
                    {/* Trame 45° : le pipeline reste visible en noir et blanc. */}
                    <pattern
                      id="hachure"
                      width={6}
                      height={6}
                      patternTransform="rotate(45)"
                      patternUnits="userSpaceOnUse"
                    >
                      <rect width={6} height={6} fill={dark ? "#3a3f4b" : "#e6e8ef"} />
                      <line x1={0} y1={0} x2={0} y2={6} stroke={axisColor} strokeWidth={2} />
                    </pattern>
                  </defs>

                  <CartesianGrid stroke={gridColor} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: axisColor, fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: gridColor }}
                  />
                  <YAxis
                    tick={{ fill: axisColor, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={64}
                    tickFormatter={(value: number) => formatMoneyShort(value)}
                  />
                  <Tooltip
                    cursor={{ fill: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0].payload as Row;
                      return (
                        <div className="border-border bg-card rounded-lg border p-3 text-xs shadow-lg">
                          <p className="mb-1 font-medium">Semaine du {row.week}</p>
                          <p className="tabular mb-2">{formatMoney(row.total)} attendus</p>
                          <ul className="flex flex-col gap-1">
                            {row.details.map((detail) => (
                              <li key={detail.name} className="flex items-center gap-2">
                                <span
                                  className="size-2 rounded-full"
                                  style={{ backgroundColor: seriesColor(detail.color, dark) }}
                                />
                                {detail.name}
                                <span className="tabular text-muted-foreground ml-auto">
                                  {formatMoney(detail.amount)}
                                </span>
                              </li>
                            ))}
                            {row.certain > 0 ? (
                              <li className="text-muted-foreground flex items-center gap-2">
                                Certain
                                <span className="tabular ml-auto">{formatMoney(row.certain)}</span>
                              </li>
                            ) : null}
                            {row.probable > 0 ? (
                              <li className="text-muted-foreground flex items-center gap-2">
                                Probable
                                <span className="tabular ml-auto">{formatMoney(row.probable)}</span>
                              </li>
                            ) : null}
                            {row.pipeline > 0 ? (
                              <li className="text-muted-foreground flex items-center gap-2">
                                Pipeline pondéré
                                <span className="tabular ml-auto">{formatMoney(row.pipeline)}</span>
                              </li>
                            ) : null}
                          </ul>
                        </div>
                      );
                    }}
                  />

                  {mode === "certainty" ? (
                    <>
                      <Bar
                        dataKey="certain"
                        stackId="a"
                        name="Certain"
                        fill={dark ? "#3987e5" : "#2a78d6"}
                        stroke={surface}
                        strokeWidth={2}
                      />
                      <Bar
                        dataKey="probable"
                        stackId="a"
                        name="Probable"
                        fill={dark ? "#7fb2ee" : "#8fbcea"}
                        stroke={surface}
                        strokeWidth={2}
                        radius={withPipeline ? undefined : [4, 4, 0, 0]}
                      />
                    </>
                  ) : (
                    data.clients.map((client) => (
                      <Bar
                        key={client.id}
                        dataKey={`byClient.${client.id}`}
                        stackId="a"
                        name={client.name}
                        stroke={surface}
                        strokeWidth={2}
                      >
                        {rows.map((row) => (
                          <Cell key={row.week} fill={seriesColor(client.color, dark)} />
                        ))}
                      </Bar>
                    ))
                  )}

                  {withPipeline ? (
                    <Bar
                      dataKey="pipeline"
                      stackId="a"
                      name="Pipeline pondéré"
                      fill="url(#hachure)"
                      stroke={surface}
                      strokeWidth={2}
                      radius={[4, 4, 0, 0]}
                    />
                  ) : null}
                </BarChart>
              </ResponsiveContainer>
            </div>

            <Legend mode={mode} clients={data.clients} dark={dark} withPipeline={withPipeline} />
            <WeekTable rows={rows} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Legend({
  mode,
  clients,
  dark,
  withPipeline,
}: {
  mode: Mode;
  clients: CashflowData["clients"];
  dark: boolean;
  withPipeline: boolean;
}) {
  const items =
    mode === "certainty"
      ? [
          { label: "Certain (facturé dans Indy)", color: dark ? "#3987e5" : "#2a78d6" },
          { label: "Probable (jours cochés)", color: dark ? "#7fb2ee" : "#8fbcea" },
        ]
      : clients.map((client) => ({ label: client.name, color: seriesColor(client.color, dark) }));

  return (
    <ul className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
          {item.label}
        </li>
      ))}
      {withPipeline ? (
        <li className="flex items-center gap-1.5">
          <span
            className="border-border size-2.5 rounded-sm border"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, currentColor 0 1px, transparent 1px 4px)",
            }}
          />
          Pipeline pondéré (estimation)
        </li>
      ) : null}
    </ul>
  );
}

/** Vue tableau : exigée dès qu'une couleur passe sous 3:1 de contraste. */
function WeekTable({ rows }: { rows: Row[] }) {
  const [open, setOpen] = useState(false);
  const visible = rows.filter((row) => row.total > 0);

  return (
    <div className="mt-4">
      <Button variant="ghost" size="sm" onClick={() => setOpen((value) => !value)}>
        {open ? "Masquer le détail" : "Voir le détail semaine par semaine"}
      </Button>
      {open ? (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border text-muted-foreground border-b text-left text-xs">
                <th className="pb-2 font-medium">Semaine du</th>
                <th className="pb-2 text-right font-medium">Certain</th>
                <th className="pb-2 text-right font-medium">Probable</th>
                <th className="pb-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.week} className="border-border/60 border-b last:border-0">
                  <td className="py-2">{row.week}</td>
                  <td className="tabular py-2 text-right">{formatMoney(row.certain)}</td>
                  <td className="tabular py-2 text-right">{formatMoney(row.probable)}</td>
                  <td className="tabular py-2 text-right font-medium">{formatMoney(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
