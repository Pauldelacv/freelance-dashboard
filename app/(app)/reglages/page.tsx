import { PageHeader } from "@/components/layout/page-header";
import { DataExport } from "@/components/settings/data-export";
import { DataRestore } from "@/components/settings/data-restore";
import { PasswordForm } from "@/components/settings/password-form";
import { SettingsForm } from "@/components/settings/settings-form";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Réglages" };

export default async function ReglagesPage() {
  const settings = await getSettings();

  return (
    <>
      <PageHeader
        title="Réglages"
        description="Lien Indy, objectifs, fiscalité, mot de passe, sauvegarde et restauration."
      />
      <div className="flex max-w-3xl flex-col gap-4">
        <SettingsForm settings={settings} />
        <PasswordForm />
        <DataExport />
        <DataRestore />
      </div>
    </>
  );
}
