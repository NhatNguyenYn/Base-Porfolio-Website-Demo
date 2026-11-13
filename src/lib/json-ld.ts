/**
 * Serializes structured data for a `<script type="application/ld+json">` block.
 *
 * `JSON.stringify` does not escape `<`, `>` or `&`, so a CMS value such as
 * `</script><script>…` would terminate the script element and execute. Escape
 * those characters (plus the JavaScript line separators) as JSON unicode
 * escapes: the payload stays valid JSON and can never close the tag.
 */
const SCRIPT_ESCAPES: Record<string, string> = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (character) => SCRIPT_ESCAPES[character] ?? character);
}
