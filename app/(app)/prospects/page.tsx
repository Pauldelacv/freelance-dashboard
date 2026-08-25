import { PageHeader } from "@/components/layout/page-header";
import { PipelineBoard, type ProspectItem } from "@/components/prospects/pipeline-board";
import { ProspectFormDialog } from "@/components/prospects/prospect-form-dialog";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { todayIso } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { openPipelineValue } from "@/lib/calculations/pipeline";

export const metadata = { title: "Prospects" };

export default async function ProspectsPage() {
  const rows = await prisma.prospect.findMany({ orderBy: [{ position: "asc" }] });

  const prospects: ProspectItem[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    company: row.company,
    email: row.email,
    phone: row.phone,
    source: row.source,
    stage: row.stage,
    estimatedRate: row.estimatedRate,
    estimatedDays: row.estimatedDays,
    probability: row.probability,
    nextAction: row.nextAction,
    nextActionAt: row.nextActionAt,
    notes: row.notes,
    clientId: row.clientId,
  }));

  return (
    <>
      <PageHeader
        title="Prospects"
        description="Glissez une carte d'une colonne à l'autre pour la faire avancer."
        action={<ProspectFormDialog />}
      />

      <Card className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-2 p-4">
        <div>
          <p className="text-muted-foreground text-xs">Pipeline pondéré</p>
          <p className="tabular text-xl font-semibold">
            {formatMoney(openPipelineValue(prospects))}
          </p>
        </div>
        <p className="text-muted-foreground text-xs">
          Somme des affaires encore ouvertes : TJM × jours × probabilité.
        </p>
      </Card>

      <PipelineBoard prospects={prospects} today={todayIso()} />
    </>
  );
}
