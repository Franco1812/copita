import { describe, expect, it } from "vitest";
import { ALLOWED_BRACKET_SIZES, cupSchema, entrySchema, makeSlug } from "./cups";

describe("Cup validation", () => {
  it.each(ALLOWED_BRACKET_SIZES)("accepts a cup of %i participants", (size) => {
    expect(cupSchema.safeParse({ title: "Una Copa", description: "", participant_count: size }).success).toBe(true);
  });

  it.each([0, 2, 6, 10, 12, 24, 100])("rejects a cup of %i participants", (size) => {
    expect(cupSchema.safeParse({ title: "Una Copa", description: "", participant_count: size }).success).toBe(false);
  });

  it("rejects non-HTTP external links", () => {
    expect(entrySchema.safeParse({ name: "Entrada", description: "", external_url: "javascript:alert(1)" }).success).toBe(false);
  });

  it("creates an URL-safe slug with a unique suffix", () => {
    const first = makeSlug("Álbumes de Metal");
    const second = makeSlug("Álbumes de Metal");
    expect(first).toMatch(/^albumes-de-metal-[a-f0-9]{8}$/);
    expect(second).not.toBe(first);
  });
});
