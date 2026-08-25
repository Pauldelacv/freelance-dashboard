import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export interface KpiTileProps {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  /** Progression 0–1 vers un objectif ; masquée si absente. */
  progress?: number | null;
  tone?: "default" | "success" | "warning" | "danger";
}

const toneClasses: Record<NonNullable<KpiTileProps["tone"]>, string> = {
  default: "text-primary",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

export function KpiTile({
  label,
  value,
  hint,
  icon: Icon,
  progress,
  tone = "default",
}: KpiTileProps) {
  const clamped =
    progress === null || progress === undefined ? null : Math.min(1, Math.max(0, progress));

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
        <Icon className={cn("size-4 shrink-0", toneClasses[tone])} />
      </div>
      <p className="tabular mt-2 text-2xl font-semibold">{value}</p>
      {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
      {clamped !== null ? (
        <div className="bg-muted mt-3 h-1.5 w-full overflow-hidden rounded-full">
          <div
            className={cn("bg-primary h-full rounded-full transition-[width]")}
            style={{ width: `${clamped * 100}%` }}
          />
        </div>
      ) : null}
    </Card>
  );
}
