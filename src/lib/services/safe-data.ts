import "server-only";

/**
 * Loads one page section without letting its failure take down the whole page.
 *
 * Each homepage section is independent: if the gallery query fails, the hero,
 * projects and articles must still render. Failures are logged with enough
 * context to debug on the server and never replaced with fabricated content —
 * the caller receives an explicit empty value it must handle.
 */
export async function loadSection<T>(label: string, load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await load();
  } catch (error) {
    console.error(`[data] section "${label}" failed`, error);
    return fallback;
  }
}
