import type { Metadata } from "next";
import { AlertTriangle, LayoutDashboard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isPasswordConfigured, isSecretConfigured } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const missing: string[] = [];
  if (!(await isPasswordConfigured())) missing.push("APP_PASSWORD_HASH");
  if (!isSecretConfigured()) missing.push("SESSION_SECRET");

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-lg">
            <LayoutDashboard className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Freelance Dashboard</p>
            <p className="text-muted-foreground text-xs">Espace privé</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Connexion</CardTitle>
          </CardHeader>
          <CardContent>
            {missing.length > 0 ? (
              <div className="flex flex-col gap-3 text-sm">
                <p className="text-warning flex items-center gap-2 font-medium">
                  <AlertTriangle className="size-4" />
                  Configuration incomplète
                </p>
                <p className="text-muted-foreground">
                  Variable{missing.length > 1 ? "s" : ""} d&apos;environnement manquante
                  {missing.length > 1 ? "s" : ""} :{" "}
                  <code className="bg-muted rounded px-1 py-0.5 text-xs">{missing.join(", ")}</code>
                </p>
                <p className="text-muted-foreground">
                  Générez les valeurs avec{" "}
                  <code className="bg-muted rounded px-1 py-0.5 text-xs">
                    npm run hash-password
                  </code>{" "}
                  puis renseignez-les dans Coolify.
                </p>
              </div>
            ) : (
              <LoginForm next={next} />
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
