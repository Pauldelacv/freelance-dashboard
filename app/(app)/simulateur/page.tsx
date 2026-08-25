import { PageHeader } from "@/components/layout/page-header";
import { RateSimulator } from "@/components/simulator/rate-simulator";
import { getSimulatorContext } from "@/lib/queries/simulator";

export const metadata = { title: "Simulateur TJM" };

export default async function SimulateurPage() {
  const context = await getSimulatorContext();

  return (
    <>
      <PageHeader
        title="Simulateur de TJM"
        description="Du revenu net visé au TJM nécessaire, et l'inverse."
      />
      <RateSimulator context={context} />
    </>
  );
}
