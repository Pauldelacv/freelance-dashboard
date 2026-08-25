import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "Simulateur TJM" };

export default function SimulateurPage() {
  return (
    <>
      <PageHeader title="Simulateur de TJM" description="Du revenu net visé au TJM nécessaire." />
      <ComingSoon
        phase="Phase 3 — simulateur de TJM"
        items={[
          "Objectif de net → TJM requis, et TJM actuel → net estimé",
          "Charges à 26,1 %, sans TVA (paramétrable)",
          "Écart avec le TJM moyen réel des 12 derniers mois",
        ]}
      />
    </>
  );
}
