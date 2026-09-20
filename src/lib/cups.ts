import { z } from "zod";
import { ALLOWED_BRACKET_SIZES, isAllowedBracketSize } from "./bracket/sizes";

export { ALLOWED_BRACKET_SIZES };

export const cupSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000),
  participant_count: z.coerce.number().int().refine(isAllowedBracketSize),
});

export const entrySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000),
  external_url: z.union([z.url().refine((url) => /^https?:\/\//.test(url)), z.literal("")]),
});

export function makeSlug(title: string) {
  const base = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 65) || "copa";
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}
