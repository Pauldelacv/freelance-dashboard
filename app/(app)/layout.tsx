import { requireSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getSearchIndex } from "@/lib/queries/search";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { CommandPalette } from "@/components/layout/command-palette";
import { signOutAction } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  const [settings, searchIndex] = await Promise.all([getSettings(), getSearchIndex()]);

  return (
    <div className="flex min-h-dvh">
      <Sidebar indyUrl={settings.indyUrl} signOut={signOutAction} />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 md:px-6 md:py-6">
          {children}
        </main>
        <MobileNav />
      </div>
      <CommandPalette items={searchIndex} indyUrl={settings.indyUrl} />
    </div>
  );
}
