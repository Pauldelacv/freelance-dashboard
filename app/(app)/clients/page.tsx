import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "Clients" };

export default function ClientsPage() {
  return (
    <>
      <PageHeader title="Clients" description="TJM, missions et suivi de facturation." />
      <ComingSoon
        phase="Phase 1 — cœur du produit"
        items={[
          "Fiche client : TJM par défaut, couleur, délai de paiement",
          "Missions avec TJM spécifique",
          "Clôture de mois : récapitulatif copiable vers Indy",
        ]}
      />
    </>
  );
}
