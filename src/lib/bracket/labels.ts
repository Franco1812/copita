type RoundShape = { round_number: number };

/**
 * Round names come from the bracket itself, not from the participant count:
 * a Cup that is not a power of two opens with a short preliminary round.
 */
export function roundLabels(matches: readonly RoundShape[]): Map<number, string> {
  const sizes = new Map<number, number>();
  for (const match of matches) sizes.set(match.round_number, (sizes.get(match.round_number) ?? 0) + 1);
  const rounds = [...sizes.keys()].sort((a, b) => a - b);
  const labels = new Map<number, string>();

  for (const round of rounds) {
    const size = sizes.get(round)!;
    const preliminary = round === 1 && rounds.length > 1 && size < sizes.get(rounds[1])!;
    labels.set(round, preliminary ? "Ronda preliminar"
      : size === 1 ? "Final"
      : size === 2 ? "Semifinales"
      : size === 4 ? "Cuartos de final"
      : size === 8 ? "Octavos de final"
      : `Ronda ${round}`);
  }
  return labels;
}
