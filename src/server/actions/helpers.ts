import "server-only";

export function getString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function getRawString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function getBool(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "on" || value === "true" || value === "1";
}

export function parseDateValue(value: string | undefined | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function readLocaleBlock(
  formData: FormData,
  locale: string,
  fields: string[],
): Record<string, string> {
  const block: Record<string, string> = {};
  for (const field of fields) {
    block[field] = getRawString(formData, `${locale}.${field}`);
  }
  return block;
}

/** Appends -2, -3… until the slug is free. */
export async function uniqueSlug(base: string, exists: (slug: string) => Promise<boolean>): Promise<string> {
  const root = base || "item";
  let candidate = root;
  let counter = 2;
  while (await exists(candidate)) {
    candidate = `${root}-${counter}`;
    counter += 1;
    if (counter > 200) return `${root}-${Date.now()}`;
  }
  return candidate;
}

export function toIntOrNull(value: string): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}
