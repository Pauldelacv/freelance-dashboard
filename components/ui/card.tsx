import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Surface de base. Pas d'ombre : sur un écran dense, trente cartes ombrées
 * produisent un bruit visuel qui écrase la hiérarchie réelle. La séparation se
 * fait au filet et au contraste de fond ; l'ombre reste réservée à ce qui
 * flotte vraiment au-dessus du contenu (dialogues, palette de commandes).
 */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("border-border bg-card rounded-(--radius-card) border", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 px-4 py-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-sm font-semibold", className)} {...props} />;
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-muted-foreground text-xs", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 pt-0 pb-4", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("border-border flex items-center gap-2 border-t px-4 py-3", className)}
      {...props}
    />
  );
}

/**
 * En-tête « titre à gauche, contrôles à droite », séparé du corps par un filet.
 * À utiliser quand le corps touche les bords (tableau, liste, graphique) :
 * sans filet, la ligne de titre flotte au-dessus des données sans s'y rattacher.
 */
export function CardBar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border-border flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3",
        className,
      )}
      {...props}
    />
  );
}
