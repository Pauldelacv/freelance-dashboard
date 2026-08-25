import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "Trésorerie" };

export default function TresoreriePage() {
  return (
    <>
      <PageHeader title="Trésorerie" description="Encaissements attendus sur 12 semaines." />
      <ComingSoon
        phase="Phase 5 — prévisionnel de trésorerie"
        items={[
          "Courbe des encaissements semaine par semaine, empilée par client",
          "Distinction certain (facturé Indy) / probable (jours cochés)",
          "Option : pipeline pondéré en zone hachurée",
        ]}
      />
    </>
  );
}
