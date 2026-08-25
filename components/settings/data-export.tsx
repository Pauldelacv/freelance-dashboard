import { Database, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TABLES = [
  { slug: "jours", label: "Jours travaillés" },
  { slug: "clients", label: "Clients" },
  { slug: "prospects", label: "Prospects" },
  { slug: "veille", label: "Veille" },
] as const;

export function DataExport() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sauvegarde et export</CardTitle>
        <p className="text-muted-foreground text-sm">
          La sauvegarde de référence reste le fichier <code>/data/app.db</code> du volume Coolify.
          Ces exports servent à relire vos données ailleurs.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <p className="mb-2 text-sm font-medium">Sauvegarde complète</p>
          <Button variant="outline" asChild>
            <a href="/api/backup" download>
              <Database />
              Télécharger le JSON
            </a>
          </Button>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Export CSV</p>
          <div className="flex flex-wrap gap-2">
            {TABLES.map((table) => (
              <Button key={table.slug} variant="outline" size="sm" asChild>
                <a href={`/api/export/${table.slug}`} download>
                  <Download />
                  {table.label}
                </a>
              </Button>
            ))}
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            Séparateur point-virgule et décimales à la virgule : s&apos;ouvre directement dans un
            tableur français.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
