import type { Locale } from "./config";
import { vi, type Dictionary } from "./messages/vi";
import { en } from "./messages/en";

const dictionaries: Record<Locale, Dictionary> = { vi, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? vi;
}

export type { Dictionary };
