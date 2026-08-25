"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Pencil, Trash2, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatMoneyShort } from "@/lib/money";
import {
  STAGES,
  STAGE_LABELS,
  groupByStage,
  totalWeightedValue,
  weightedValue,
  type Stage,
} from "@/lib/calculations/pipeline";
import {
  ProspectFormDialog,
  type ProspectFormValues,
} from "@/components/prospects/prospect-form-dialog";
import {
  convertProspectAction,
  deleteProspectAction,
  moveProspectAction,
} from "@/app/(app)/prospects/actions";

export interface ProspectItem extends ProspectFormValues {
  clientId: string | null;
}

export function PipelineBoard({ prospects, today }: { prospects: ProspectItem[]; today: string }) {
  const [pending, startTransition] = useTransition();
  const [dragged, setDragged] = useState<string | null>(null);
  const [hovered, setHovered] = useState<Stage | null>(null);
  const groups = groupByStage(prospects);

  function move(id: string, stage: Stage) {
    setDragged(null);
    setHovered(null);
    const prospect = prospects.find((item) => item.id === id);
    if (!prospect || prospect.stage === stage) return;
    startTransition(async () => {
      await moveProspectAction({ id, stage });
    });
  }

  return (
    <div className="grid gap-3 lg:grid-cols-4">
      {STAGES.map((stage) => {
        const items = groups[stage];
        const total = totalWeightedValue(items);

        return (
          <section
            key={stage}
            onDragOver={(event) => {
              event.preventDefault();
              setHovered(stage);
            }}
            onDragLeave={() => setHovered((current) => (current === stage ? null : current))}
            onDrop={(event) => {
              event.preventDefault();
              if (dragged) move(dragged, stage);
            }}
            className={cn(
              "flex flex-col gap-2 rounded-(--radius-card) border border-dashed p-2 transition-colors",
              hovered === stage ? "border-primary bg-accent/40" : "border-border",
            )}
          >
            <header className="flex items-baseline justify-between gap-2 px-1 pt-1">
              <h2 className="text-sm font-medium">{STAGE_LABELS[stage]}</h2>
              <span className="tabular text-muted-foreground text-xs">
                {items.length} · {formatMoneyShort(total)}
              </span>
            </header>

            {items.map((prospect) => {
              const late =
                prospect.nextActionAt !== null &&
                prospect.nextActionAt <= today &&
                (stage === "contacted" || stage === "quoted");

              return (
                <Card
                  key={prospect.id}
                  draggable
                  onDragStart={() => setDragged(prospect.id)}
                  onDragEnd={() => setDragged(null)}
                  className={cn(
                    "flex cursor-grab flex-col gap-2 p-3 active:cursor-grabbing",
                    dragged === prospect.id && "opacity-50",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{prospect.name}</p>
                      {prospect.company ? (
                        <p className="text-muted-foreground truncate text-xs">{prospect.company}</p>
                      ) : null}
                    </div>
                    <Badge
                      variant={prospect.probability >= 70 ? "success" : "muted"}
                      className="shrink-0 whitespace-nowrap"
                    >
                      {prospect.probability} %
                    </Badge>
                  </div>

                  <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {prospect.estimatedRate ? (
                      <span className="tabular">
                        {formatMoneyShort(prospect.estimatedRate)} / j
                      </span>
                    ) : null}
                    {prospect.estimatedDays ? <span>{prospect.estimatedDays} j</span> : null}
                    {weightedValue(prospect) > 0 ? (
                      <span className="tabular text-foreground font-medium">
                        {formatMoneyShort(weightedValue(prospect))} pondérés
                      </span>
                    ) : null}
                  </div>

                  {prospect.nextAction || prospect.nextActionAt ? (
                    <p
                      className={cn(
                        "flex items-center gap-1 text-xs",
                        late ? "text-warning" : "text-muted-foreground",
                      )}
                    >
                      {late ? <AlertCircle className="size-3.5 shrink-0" /> : null}
                      {prospect.nextAction ?? "Prochaine action"}
                      {prospect.nextActionAt ? ` · ${prospect.nextActionAt}` : ""}
                    </p>
                  ) : null}

                  <div className="flex items-center justify-between gap-1 pt-1">
                    <select
                      aria-label={`Étape de ${prospect.name}`}
                      value={prospect.stage}
                      onChange={(event) => move(prospect.id, event.target.value as Stage)}
                      className="border-input bg-card h-7 max-w-32 min-w-0 rounded-md border px-1.5 text-xs"
                    >
                      {STAGES.map((value) => (
                        <option key={value} value={value}>
                          {STAGE_LABELS[value]}
                        </option>
                      ))}
                    </select>

                    <div className="flex shrink-0 items-center">
                      {prospect.clientId === null ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Convertir ${prospect.name} en client`}
                          disabled={pending}
                          onClick={() =>
                            startTransition(async () => {
                              await convertProspectAction(prospect.id);
                            })
                          }
                        >
                          <UserPlus />
                        </Button>
                      ) : (
                        <Badge variant="success">Client</Badge>
                      )}
                      <ProspectFormDialog
                        prospect={prospect}
                        trigger={
                          <Button variant="ghost" size="icon" aria-label="Modifier">
                            <Pencil />
                          </Button>
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Supprimer"
                        disabled={pending}
                        onClick={() => {
                          if (!window.confirm(`Supprimer « ${prospect.name} » ?`)) return;
                          startTransition(async () => {
                            await deleteProspectAction(prospect.id);
                          });
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}

            <ProspectFormDialog
              defaultStage={stage}
              trigger={
                <Button variant="ghost" size="sm" className="text-muted-foreground justify-start">
                  + Ajouter
                </Button>
              }
            />
          </section>
        );
      })}
    </div>
  );
}
