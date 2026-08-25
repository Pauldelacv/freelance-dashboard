import { PageHeader } from "@/components/layout/page-header";
import { CashflowChart } from "@/components/cashflow/cashflow-chart";
import { Card } from "@/components/ui/card";
import { getCashflow } from "@/lib/queries/cashflow";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Trésorerie" };

export default async function TresoreriePage() {
  const data = await getCashflow();

  return (
    <>
      <PageHeader title="Trésorerie" description="Ce qui devrait rentrer, semaine par semaine." />

      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="Attendu sous 4 semaines"
          value={formatMoney(data.totals.nextMonth)}
          hint="Certain + probable"
        />
        <Tile
          label="Certain sur 12 semaines"
          value={formatMoney(data.totals.certain)}
          hint="Déjà facturé dans Indy"
          tone="success"
        />
        <Tile
          label="Probable sur 12 semaines"
          value={formatMoney(data.totals.probable)}
          hint="Jours cochés, pas encore facturés"
          tone="warning"
        />
        <Tile
          label="Pipeline pondéré"
          value={formatMoney(data.pipelineTotal)}
          hint="Prospects ouverts, hors prévisionnel par défaut"
        />
      </section>

      <CashflowChart data={data} />
    </>
  );
}

function Tile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "success" | "warning";
}) {
  return (
    <Card className="p-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={`tabular mt-1 text-xl font-semibold ${
          tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : ""
        }`}
      >
        {value}
      </p>
      <p className="text-muted-foreground mt-1 text-xs">{hint}</p>
    </Card>
  );
}
