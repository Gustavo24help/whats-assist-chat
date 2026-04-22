import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formata número como moeda brasileira (R$ 3.768,00). */
export function formatBRL(value: number | null | undefined, fallback = "R$ 0,00"): string {
  if (value === null || value === undefined || isNaN(Number(value))) return fallback;
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

