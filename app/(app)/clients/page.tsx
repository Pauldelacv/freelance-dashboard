import Link from "next/link";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { Badge, ColorDot } from "@/components/ui/badge";
import { Card, CardBar, CardTitle } from "@/components/ui/card";
import { Table, TableWrap, TBody, TD, TFoot, TH, THead, TR } from "@/components/ui/table";
import { listClientSummaries, type ClientSummary } from "@/lib/queries/clients";
import { formatMoney, formatMoneyShort } from "@/lib/money";
import { cn } from "@/lib/utils";

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
        <div className="flex flex-col gap-4">
          <ClientTable clients={active} withTotals />
          {archived.length > 0 ? <ClientTable clients={archived} title="Archivés" /> : null}
        </div>
      )}
    </>
  );
}

/**
 * Les clients se lisent en colonne, pas en galerie.
 *
 * Une grille de cartes empêche la seule question qu'on se pose sur cet écran :
 * *lequel me doit le plus, lequel a le meilleur TJM ?* Les valeurs n'y sont
 * jamais sur la même verticale — et deux cartes voisines se décalent dès que
 * l'une porte une raison sociale et l'autre non. Le tableau aligne, et permet
 * en prime une ligne de totaux, qu'une galerie ne peut pas produire.
 */
function ClientTable({
  clients,
  title,
  withTotals,
}: {
  clients: ClientSummary[];
  title?: string;
  withTotals?: boolean;
}) {
  const totals = clients.reduce(
    (sum, client) => ({
      days: sum.days + client.totalDays,
      yearRevenue: sum.yearRevenue + client.yearRevenue,
      toInvoice: sum.toInvoice + client.toInvoice,
      awaitingPayment: sum.awaitingPayment + client.awaitingPayment,
    }),
    { days: 0, yearRevenue: 0, toInvoice: 0, awaitingPayment: 0 },
  );

  return (
    <Card className="overflow-hidden">
      {title ? (
        <CardBar>
          <CardTitle className="text-muted-foreground">{title}</CardTitle>
          <span className="text-subtle-foreground tabular text-xs">
            {clients.length} client{clients.length > 1 ? "s" : ""}
          </span>
        </CardBar>
      ) : null}

      <TableWrap>
        <Table>
          <THead>
            <tr>
              <TH>Client</TH>
              <TH numeric>TJM</TH>
              <TH numeric className="hidden md:table-cell">
                Jours
              </TH>
              <TH numeric>CA de l&apos;année</TH>
              <TH numeric>À facturer</TH>
              <TH numeric className="hidden lg:table-cell">
                En attente
              </TH>
              <TH className="hidden xl:table-cell">Dernier jour</TH>
              <TH className="hidden sm:table-cell">Statut</TH>
            </tr>
          </THead>

          <TBody>
            {clients.map((client) => (
              <TR key={client.id}>
                <TD>
                  <div className="flex min-w-0 items-center gap-2">
                    <ColorDot color={client.color} />
                    <div className="min-w-0">
                      <Link
                        href={`/clients/${client.id}`}
                        className="font-medium hover:underline"
                        // La zone cliquable couvre toute la ligne sans imbriquer
                        // d'éléments interactifs les uns dans les autres.
                      >
                        <span className="truncate">{client.name}</span>
                      </Link>
                      {client.company ? (
                        <p className="text-subtle-foreground truncate text-xs">{client.company}</p>
                      ) : null}
                    </div>
                  </div>
                </TD>
                <TD numeric>{formatMoneyShort(client.defaultRate)}</TD>
                <TD numeric className="hidden md:table-cell">
                  {client.totalDays.toLocaleString("fr-FR")}
                </TD>
                <TD numeric>{formatMoneyShort(client.yearRevenue)}</TD>
                <TD numeric className={cn(client.toInvoice > 0 && "text-warning font-medium")}>
                  {client.toInvoice > 0 ? formatMoney(client.toInvoice) : "—"}
                </TD>
                <TD numeric className="hidden lg:table-cell">
                  {client.awaitingPayment > 0 ? formatMoney(client.awaitingPayment) : "—"}
                </TD>
                <TD className="text-muted-foreground hidden text-xs whitespace-nowrap xl:table-cell">
                  {client.lastWorkedDate ?? "—"}
                </TD>
                <TD className="hidden sm:table-cell">
                  <Badge variant={client.status === "archived" ? "muted" : "outline"}>
                    {STATUS_LABELS[client.status] ?? client.status}
                  </Badge>
                </TD>
              </TR>
            ))}
          </TBody>

          {withTotals && clients.length > 1 ? (
            <TFoot>
              <tr>
                <TD className="metric-label">Total</TD>
                <TD numeric className="text-muted-foreground">
                  —
                </TD>
                <TD numeric className="hidden md:table-cell">
                  {totals.days.toLocaleString("fr-FR")}
                </TD>
                <TD numeric>{formatMoneyShort(totals.yearRevenue)}</TD>
                <TD numeric className={cn(totals.toInvoice > 0 && "text-warning")}>
                  {formatMoney(totals.toInvoice)}
                </TD>
                <TD numeric className="hidden lg:table-cell">
                  {formatMoney(totals.awaitingPayment)}
                </TD>
                <TD className="hidden xl:table-cell" />
                <TD className="hidden sm:table-cell" />
              </tr>
            </TFoot>
          ) : null}
        </Table>
      </TableWrap>
    </Card>
  );
}
