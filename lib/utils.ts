import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Fusionne des classes Tailwind sans conflit (dernière gagnante). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
