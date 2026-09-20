export const ALLOWED_BRACKET_SIZES = [4, 8, 16, 32, 64] as const;

export type BracketSize = (typeof ALLOWED_BRACKET_SIZES)[number];

export function isAllowedBracketSize(value: number): value is BracketSize {
  return ALLOWED_BRACKET_SIZES.some((size) => size === value);
}
