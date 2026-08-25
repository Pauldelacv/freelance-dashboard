import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Étiquette d'état. Rayon faible plutôt que pilule : à cette taille, la pilule
 * fait « puce décorative » alors qu'il s'agit d'une donnée (statut de
 * facturation, statut de client). Les fonds `-soft` restent assez pâles pour
 * que l'encre garde son contraste.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-accent text-accent-foreground",
        muted: "bg-muted text-muted-foreground",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning",
        danger: "bg-danger-soft text-danger",
        outline: "border-border text-muted-foreground border",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/**
 * Pastille de couleur d'un client. `aria-hidden` : la couleur ne porte jamais
 * l'information seule, un libellé texte l'accompagne systématiquement.
 */
export function ColorDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("size-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: color }}
    />
  );
}
