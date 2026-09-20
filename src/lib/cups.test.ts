import { describe, expect, it } from "vitest";
import { MAX_PARTICIPANTS, MIN_PARTICIPANTS, cupSchema, entrySchema, makeSlug } from "./cups";

describe("Cup validation", () => {
  it.each([4, 5, 8, 17, 64, 100, 128, 149, 150])("accepts a cup of %i participants", (size) => {
    expect(cupSchema.safeParse({ title: "Una Copa", description: "", participant_count: size }).success).toBe(true);
  });

  it.each([0, 1, 3, 151, 300])("rejects a cup of %i participants", (size) => {
    expect(cupSchema.safeParse({ title: "Una Copa", description: "", participant_count: size }).success).toBe(false);
  });

  it("rejects a fractional participant count", () => {
    expect(cupSchema.safeParse({ title: "Una Copa", description: "", participant_count: 12.5 }).success).toBe(false);
  });

  it("keeps the advertised range in sync with the schema", () => {
    const parse = (participant_count: number) =>
      cupSchema.safeParse({ title: "Una Copa", description: "", participant_count }).success;
    expect(parse(MIN_PARTICIPANTS)).toBe(true);
    expect(parse(MAX_PARTICIPANTS)).toBe(true);
    expect(parse(MIN_PARTICIPANTS - 1)).toBe(false);
    expect(parse(MAX_PARTICIPANTS + 1)).toBe(false);
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
