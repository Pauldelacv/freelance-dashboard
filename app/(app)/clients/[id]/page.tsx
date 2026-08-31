import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Badge, ColorDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { MonthClosing } from "@/components/clients/month-closing";
import { MissionList } from "@/components/clients/mission-list";
import { getClientDetail } from "@/lib/queries/clients";
import { getSettings } from "@/lib/settings";
import { formatMoney, formatMoneyShort } from "@/lib/money";
import { formatLongDate } from "@/lib/dates";

const BILLING_LABELS: Record<string, string> = {
  pending: "À facturer",
  invoiced: "Facturé",
  paid: "Encaissé",
};

const TYPE_LABELS: Record<string, string> = {
  billable: "Facturable",
  internal: "Interne",
  training: "Formation",
  off: "Congé",
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getClientDetail(id);
  return { title: client?.name ?? "Client" };
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [client, settings] = await Promise.all([getClientDetail(id), getSettings()]);
  if (!client) notFound();

  return (
    <>
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/clients">
            <ArrowLeft />
            Tous les clients
          </Link>
        </Button>
      </div>

      <header className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-2.5">
          {/* Même échelle que `PageHeader` : sur une application dense, le titre
              d'écran ne doit pas changer de taille d'une page à l'autre. */}
          <ColorDot color={client.color} className="size-2.5" />
          <div className="min-w-0">
            <h1 className="text-base font-semibold">{client.name}</h1>
            <p className="text-muted-foreground text-sm">
              {[client.company, client.email, client.phone].filter(Boolean).join(" · ") ||
                "Aucun contact renseigné"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {settings.indyUrl ? (
            <Button variant="outline" asChild>
              <a href={settings.indyUrl} target="_blank" rel="noreferrer noopener">
                <ExternalLink />
                Indy
              </a>
            </Button>
          ) : null}
          <ClientFormDialog
            client={client}
            trigger={<Button variant="secondary">Modifier</Button>}
          />
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Stat label="TJM par défaut" value={formatMoneyShort(client.defaultRate)} />
        <Stat
          label="TJM moyen réel"
          value={client.averageRate ? formatMoneyShort(client.averageRate) : "—"}
        />
        <Stat label="CA de l'année" value={formatMoneyShort(client.yearRevenue)} />
        <Stat label="CA total" value={formatMoneyShort(client.totalRevenue)} />
        <Stat label="À facturer" value={formatMoneyShort(client.toInvoice)} tone="warning" />
        <Stat
          label="Facturé non encaissé"
          value={formatMoneyShort(client.awaitingPayment)}
          tone="success"
        />
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Facturation par mois</CardTitle>
            <p className="text-muted-foreground text-sm">
              La facture se crée dans Indy. Ici on suit seulement l&apos;état : à facturer → facturé
              → encaissé. Les missions au forfait se suivent une par une, plus bas.
            </p>
          </CardHeader>
          <CardContent>
            <MonthClosing
              clientId={client.id}
              clientName={client.name}
              months={client.months}
              indyUrl={settings.indyUrl}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fiche</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <Row
              label="Statut"
              value={
                client.status === "archived"
                  ? "Archivé"
                  : client.status === "prospect"
                    ? "Prospect"
                    : "Actif"
              }
            />
            <Row label="Délai de paiement" value={`${client.paymentTerms} jours`} />
            <Row label="Jours facturables" value={client.totalDays.toLocaleString("fr-FR")} />
            <Row label="Jours travaillés" value={client.workedDaysCount.toLocaleString("fr-FR")} />
            <Row
              label="Dernier jour saisi"
              value={client.lastWorkedDate ? formatLongDate(client.lastWorkedDate) : "—"}
            />
            {client.notes ? (
              <p className="bg-muted text-muted-foreground rounded-lg p-3 text-sm whitespace-pre-wrap">
                {client.notes}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Missions</CardTitle>
            <p className="text-muted-foreground text-sm">
              En régie, la mission ne porte qu&apos;un TJM : le CA vient des jours cochés. Au
              forfait, elle porte le montant convenu — un seul paiement, quel que soit le nombre de
              jours passés.
            </p>
          </CardHeader>
          <CardContent>
            <MissionList
              clientId={client.id}
              clientName={client.name}
              clientRate={client.defaultRate}
              missions={client.missions}
              indyUrl={settings.indyUrl}
            />
          </CardContent>
        </Card>
      </section>

      <section className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Jours saisis</CardTitle>
          </CardHeader>
          <CardContent>
            {client.days.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Aucun jour saisi. Rendez-vous dans le calendrier.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-border text-muted-foreground border-b text-left text-xs">
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 font-medium">Durée</th>
                      <th className="pb-2 font-medium">Type</th>
                      <th className="pb-2 text-right font-medium">TJM</th>
                      <th className="pb-2 text-right font-medium">Montant</th>
                      <th className="pb-2 text-right font-medium">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {client.days.slice(0, 60).map((day) => (
                      <tr key={day.id} className="border-border/60 border-b last:border-0">
                        <td className="py-2">{day.date}</td>
                        <td className="py-2">{day.fraction === 0.5 ? "½ journée" : "1 journée"}</td>
                        <td className="text-muted-foreground py-2">{TYPE_LABELS[day.type]}</td>
                        <td className="tabular py-2 text-right">{formatMoney(day.rate)}</td>
                        <td className="tabular py-2 text-right">
                          {day.type === "billable"
                            ? formatMoney(Math.round(day.rate * day.fraction))
                            : "—"}
                        </td>
                        <td className="py-2 text-right">
                          <Badge
                            variant={
                              day.billing === "paid"
                                ? "success"
                                : day.billing === "invoiced"
                                  ? "default"
                                  : "warning"
                            }
                          >
                            {BILLING_LABELS[day.billing]}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {client.days.length > 60 ? (
                  <p className="text-muted-foreground mt-3 text-xs">
                    60 jours les plus récents affichés sur {client.days.length}.
                  </p>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warning" | "success";
}) {
  return (
    <Card className="p-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={`tabular mt-1 text-xl font-semibold ${
          tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : ""
        }`}
      >
        {value}
      </p>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
