import { Construction } from "lucide-react";
import { Card } from "@/components/ui/card";

/** Écran d'attente pour les modules planifiés (voir CLAUDE.md §8). */
export function ComingSoon({ phase, items }: { phase: string; items: string[] }) {
  return (
    <Card className="flex flex-col items-start gap-3 p-6">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Construction className="text-warning size-4" />
        {phase}
      </div>
      <ul className="text-muted-foreground flex list-inside list-disc flex-col gap-1 text-sm">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </Card>
  );
}
