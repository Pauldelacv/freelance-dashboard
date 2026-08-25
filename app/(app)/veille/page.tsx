import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "Veille" };

export default function VeillePage() {
  return (
    <>
      <PageHeader title="Veille" description="Annuaire des sites suivis." />
      <ComingSoon
        phase="Phase 2 — veille"
        items={[
          "Ajout rapide par URL, titre et favicon récupérés automatiquement",
          "Catégories, tags, favoris, recherche",
          "Import / export JSON et OPML",
        ]}
      />
    </>
  );
}
