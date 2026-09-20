import { randomUUID } from "node:crypto";
import {
  MAX_PARTICIPANTS,
  MIN_PARTICIPANTS,
  bracketSizeFor,
  byeCountFor,
  firstRoundMatchCountFor,
  isAllowedParticipantCount,
  roundCountFor,
} from "./sizes";
import { shuffle, type RandomIndex } from "./shuffle";
import type { BracketMatch, BracketState, NextSlot } from "./types";

const SLOTS: readonly NextSlot[] = ["a", "b"];

/**
 * Spreads the byes evenly across the second-round slots so the preliminary
 * matches are not all bunched at one end of the bracket.
 */
function byeSlotIndexes(slotCount: number, byes: number): Set<number> {
  const indexes = new Set<number>();
  for (let bye = 0; bye < byes; bye++) indexes.add(Math.floor((bye * slotCount) / byes));
  return indexes;
}

/**
 * Builds every match once. Cups that are not a power of two get a short
 * preliminary round; the participants that skip it are seeded straight into
 * round two. Only those seeded slots are populated up front.
 */
export function generateBracket(
  entryIds: readonly string[],
  options: { randomIndex?: RandomIndex; createId?: () => string } = {},
): BracketState {
  const participants = entryIds.length;
  if (!isAllowedParticipantCount(participants)) {
    throw new RangeError(`Bracket size must be between ${MIN_PARTICIPANTS} and ${MAX_PARTICIPANTS}.`);
  }
  if (entryIds.some((id) => !id.trim()) || new Set(entryIds).size !== participants) {
    throw new Error("Every entry must have a unique, nonempty ID.");
  }

  const shuffled = shuffle(entryIds, options.randomIndex);
  const createId = options.createId ?? randomUUID;
  const bracketSize = bracketSizeFor(participants);
  const totalRounds = roundCountFor(participants);
  const byes = byeCountFor(participants);
  const firstRoundMatches = firstRoundMatchCountFor(participants);

  // Rounds two and up are always a complete bracket over bracketSize / 2 entrants.
  const laterRounds: BracketMatch[][] = [];
  for (let roundNumber = 2; roundNumber <= totalRounds; roundNumber++) {
    const round: BracketMatch[] = [];
    for (let position = 1; position <= bracketSize / 2 ** roundNumber; position++) {
      round.push({
        id: createId(),
        roundNumber,
        position,
        participantAId: null,
        participantBId: null,
        winnerEntryId: null,
        nextMatchId: null,
        nextSlot: null,
      });
    }
    laterRounds.push(round);
  }

  for (let index = 0; index < laterRounds.length - 1; index++) {
    for (const match of laterRounds[index]) {
      match.nextMatchId = laterRounds[index + 1][Math.ceil(match.position / 2) - 1].id;
      match.nextSlot = match.position % 2 === 1 ? "a" : "b";
    }
  }

  // Walk the second-round slots in order: a bye seeds a participant directly,
  // anything else is fed by a freshly created preliminary match.
  const entryRound = laterRounds[0];
  const slotCount = bracketSize / 2;
  const byeSlots = byeSlotIndexes(slotCount, byes);
  const firstRound: BracketMatch[] = [];
  let slotIndex = 0;
  let nextEntry = 2 * firstRoundMatches;
  let nextSeed = 0;

  for (const match of entryRound) {
    for (const slot of SLOTS) {
      if (byeSlots.has(slotIndex)) {
        if (slot === "a") match.participantAId = shuffled[nextEntry++];
        else match.participantBId = shuffled[nextEntry++];
      } else {
        firstRound.push({
          id: createId(),
          roundNumber: 1,
          position: firstRound.length + 1,
          participantAId: shuffled[nextSeed++],
          participantBId: shuffled[nextSeed++],
          winnerEntryId: null,
          nextMatchId: match.id,
          nextSlot: slot,
        });
      }
      slotIndex++;
    }
  }

  const matches = [...firstRound, ...laterRounds.flat()];
  if (matches.length !== participants - 1) {
    throw new Error("The bracket must hold exactly one match less than its participants.");
  }
  if (new Set(matches.map((match) => match.id)).size !== matches.length) {
    throw new Error("Match IDs must be unique.");
  }
  return { matches, status: "active", championEntryId: null };
}
