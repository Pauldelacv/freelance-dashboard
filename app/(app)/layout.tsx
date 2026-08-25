import { requireSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { signOutAction } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  const settings = await getSettings();

  return (
    <div className="flex min-h-dvh">
      <Sidebar indyUrl={settings.indyUrl} signOut={signOutAction} />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        <MobileNav />
      </div>
    </div>
  );
}
