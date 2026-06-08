import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// Shared across pages — "Boston Celtics" not "Boston Boston Celtics"
export function teamFullName(city: string, name: string): string {
  if (!city || !name) return name || city || "";
  if (name.toLowerCase().startsWith(city.toLowerCase())) return name;
  return `${city} ${name}`;
}
