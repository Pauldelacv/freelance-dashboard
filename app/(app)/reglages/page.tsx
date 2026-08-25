import { PageHeader } from "@/components/layout/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Réglages" };

export default async function ReglagesPage() {
  const settings = await getSettings();

  return (
    <>
      <PageHeader
        title="Réglages"
        description="Lien Indy, objectifs, fiscalité et préférences de saisie."
      />
      <div className="max-w-3xl">
        <SettingsForm settings={settings} />
      </div>
    </>
  );
}
