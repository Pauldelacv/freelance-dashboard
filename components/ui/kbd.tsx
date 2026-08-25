import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Touche de clavier. Elle sert à *annoncer* les raccourcis dans l'interface :
 * un raccourci qu'on ne découvre qu'en lisant la documentation n'existe pas.
 */
export function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "border-border bg-muted text-muted-foreground inline-flex h-5 min-w-5 items-center justify-center",
        "rounded border px-1 font-sans text-[11px] font-medium",
        className,
      )}
      {...props}
    />
  );
}
