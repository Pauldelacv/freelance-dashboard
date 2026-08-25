import Link from "next/link";
import { ArrowUpRight, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { listClientSummaries } from "@/lib/queries/clients";
import { formatMoney, formatMoneyShort } from "@/lib/money";

export const metadata = { title: "Clients" };

const STATUS_LABELS: Record<string, string> = {
  active: "Actif",
  prospect: "Prospect",
  archived: "Archivé",
};

export default async function ClientsPage() {
  const clients = await listClientSummaries();
  const active = clients.filter((client) => client.status !== "archived");
  const archived = clients.filter((client) => client.status === "archived");

  return (
    <>
      <PageHeader
        title="Clients"
        description="TJM par défaut, couleur du calendrier et suivi de facturation."
        action={<ClientFormDialog />}
      />

      {clients.length === 0 ? (
        <Card className="flex flex-col items-start gap-3 p-8">
          <Users className="text-muted-foreground size-5" />
          <div>
            <p className="font-medium">Aucun client pour l&apos;instant</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Créez un premier client avec son TJM : il deviendra sélectionnable dans le calendrier
              pour cocher vos journées.
            </p>
          </div>
          <ClientFormDialog />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <ClientGrid clients={active} />
          {archived.length > 0 ? (
            <section>
              <h2 className="text-muted-foreground mb-3 text-sm font-medium">Archivés</h2>
              <ClientGrid clients={archived} />
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}

function ClientGrid({ clients }: { clients: Awaited<ReturnType<typeof listClientSummaries>> }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {clients.map((client) => (
        <Card key={client.id} className="flex flex-col gap-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: client.color }}
                aria-hidden
              />
              <div className="min-w-0">
                <Link
                  href={`/clients/${client.id}`}
                  className="flex items-center gap-1 font-medium hover:underline"
                >
                  <span className="truncate">{client.name}</span>
                  <ArrowUpRight className="text-muted-foreground size-3.5 shrink-0" />
                </Link>
                {client.company ? (
                  <p className="text-muted-foreground truncate text-xs">{client.company}</p>
                ) : null}
              </div>
            </div>
            <Badge variant={client.status === "archived" ? "muted" : "outline"}>
              {STATUS_LABELS[client.status] ?? client.status}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="TJM" value={formatMoneyShort(client.defaultRate)} />
            <Stat label="CA de l'année" value={formatMoneyShort(client.yearRevenue)} />
            <Stat label="Jours facturés" value={client.totalDays.toLocaleString("fr-FR")} />
            <Stat
              label="À facturer"
              value={formatMoney(client.toInvoice)}
              tone={client.toInvoice > 0 ? "warning" : undefined}
            />
          </div>
        </Card>
      ))}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warning" }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={`tabular font-medium ${tone === "warning" ? "text-warning" : ""}`}>{value}</p>
    </div>
  );
}
