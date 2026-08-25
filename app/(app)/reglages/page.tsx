import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "Réglages" };

export default function ReglagesPage() {
  return (
    <>
      <PageHeader title="Réglages" description="Objectifs, fiscalité, lien Indy, sauvegarde." />
      <ComingSoon
        phase="Phase 1 — réglages"
        items={[
          "URL de l'espace Indy et objectifs par défaut",
          "Taux de charges (26,1 %) et TVA",
          "Export CSV et sauvegarde JSON complète",
        ]}
      />
    </>
  );
}
