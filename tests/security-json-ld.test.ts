import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "@/lib/json-ld";

describe("JSON-LD serialization", () => {
  it("escapes a script-closing payload from CMS content", () => {
    const payload = {
      "@type": "BlogPosting",
      headline: "Hello </script><script>alert(document.cookie)</script>",
      description: "Tom & Jerry",
    };

    const json = serializeJsonLd(payload);

    expect(json).not.toContain("</script>");
    expect(json).not.toContain("<script");
    expect(json).not.toContain("&");
    expect(json).toContain("\\u003c/script\\u003e");
    expect(json).toContain("\\u0026");
  });

  it("keeps the payload valid JSON with the original values", () => {
    const payload = { headline: "a </script> b", nested: [{ text: "<img onerror=x>" }] };
    expect(JSON.parse(serializeJsonLd(payload))).toEqual(payload);
  });

  it("escapes JavaScript line separators that can terminate a string", () => {
    const json = serializeJsonLd({ text: "line\u2028break\u2029end" });
    expect(json).not.toContain("\u2028");
    expect(json).not.toContain("\u2029");
    expect(json).toContain("\\u2028");
    expect(json).toContain("\\u2029");
    expect(JSON.parse(json)).toEqual({ text: "line\u2028break\u2029end" });
  });
});
