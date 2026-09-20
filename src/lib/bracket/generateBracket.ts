import { randomUUID } from "node:crypto";
import { isAllowedBracketSize } from "./sizes";
import { shuffle, type RandomIndex } from "./shuffle";
import type { BracketMatch, BracketState } from "./types";

/** Builds every match once; only first-round slots are populated. */
export function generateBracket(
  entryIds: readonly string[],
  options: { randomIndex?: RandomIndex; createId?: () => string } = {},
): BracketState {
  if (!isAllowedBracketSize(entryIds.length)) {
    throw new RangeError("Bracket size must be 4, 8, 16, 32 or 64.");
  }
  if (entryIds.some((id) => !id.trim()) || new Set(entryIds).size !== entryIds.length) {
    throw new Error("Every entry must have a unique, nonempty ID.");
  }

  const shuffled = shuffle(entryIds, options.randomIndex);
  const createId = options.createId ?? randomUUID;
  const rounds: BracketMatch[][] = [];
  let matchesInRound = entryIds.length / 2;
  let roundNumber = 1;

  while (matchesInRound >= 1) {
    const round: BracketMatch[] = [];
    for (let position = 1; position <= matchesInRound; position++) {
      const offset = (position - 1) * 2;
      round.push({
        id: createId(),
        roundNumber,
        position,
        participantAId: roundNumber === 1 ? shuffled[offset] : null,
        participantBId: roundNumber === 1 ? shuffled[offset + 1] : null,
        winnerEntryId: null,
        nextMatchId: null,
        nextSlot: null,
      });
    }
    rounds.push(round);
    matchesInRound /= 2;
    roundNumber++;
  }

  for (let round = 0; round < rounds.length - 1; round++) {
    for (const match of rounds[round]) {
      match.nextMatchId = rounds[round + 1][Math.ceil(match.position / 2) - 1].id;
      match.nextSlot = match.position % 2 === 1 ? "a" : "b";
    }
  }

  const matches = rounds.flat();
  if (new Set(matches.map((match) => match.id)).size !== matches.length) {
    throw new Error("Match IDs must be unique.");
  }
  return { matches, status: "active", championEntryId: null };
}
