import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "Calendrier" };

export default function CalendrierPage() {
  return (
    <>
      <PageHeader title="Calendrier" description="Cocher les jours travaillés." />
      <ComingSoon
        phase="Phase 1 — cœur du produit"
        items={[
          "Grille mensuelle, clic = journée, Shift+clic = demi-journée",
          "Client actif, pastille de couleur, clic-glissé sur une plage",
          "Week-ends et jours fériés grisés, totaux en pied de calendrier",
        ]}
      />
    </>
  );
}
