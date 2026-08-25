import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "Prospects" };

export default function ProspectsPage() {
  return (
    <>
      <PageHeader title="Prospects" description="Pipeline commercial." />
      <ComingSoon
        phase="Phase 4 — pipeline prospects"
        items={[
          "Kanban Contacté → Devis envoyé → Gagné / Perdu",
          "Valeur pondérée (TJM × jours × probabilité)",
          "Relances et conversion en client",
        ]}
      />
    </>
  );
}
