import { describe, expect, it } from "vitest";
import { advanceWinner } from "./advanceWinner";
import { generateBracket } from "./generateBracket";
import {
  MAX_PARTICIPANTS,
  MIN_PARTICIPANTS,
  bracketSizeFor,
  byeCountFor,
  firstRoundMatchCountFor,
  isAllowedParticipantCount,
  roundCountFor,
} from "./sizes";
import { shuffle } from "./shuffle";
import { roundLabels } from "./labels";
import type { BracketMatch, BracketState } from "./types";

const entries = (count: number) => Array.from({ length: count }, (_, index) => `entry-${index + 1}`);
const noSwap = (maxExclusive: number) => maxExclusive - 1;

/** Every size the app can produce, plus the awkward ones in between. */
const sizes = [4, 5, 7, 8, 9, 15, 16, 17, 33, 64, 65, 100, 128, 129, 149, 150];

describe("participant counts", () => {
  it.each(sizes)("accepts %i", (size) => {
    expect(isAllowedParticipantCount(size)).toBe(true);
  });

  it.each([0, 1, 3, 151, 300, 4.5, Number.NaN])("rejects %s", (size) => {
    expect(isAllowedParticipantCount(size)).toBe(false);
  });

  it.each([0, 1, 3, 151, 300])("refuses to build a bracket for %i entries", (size) => {
    expect(() => generateBracket(entries(size))).toThrow(RangeError);
  });

  it("accepts the whole documented range", () => {
    expect(isAllowedParticipantCount(MIN_PARTICIPANTS)).toBe(true);
    expect(isAllowedParticipantCount(MAX_PARTICIPANTS)).toBe(true);
    expect(isAllowedParticipantCount(MIN_PARTICIPANTS - 1)).toBe(false);
    expect(isAllowedParticipantCount(MAX_PARTICIPANTS + 1)).toBe(false);
  });

  it("derives the bracket shape of a Cup that is not a power of two", () => {
    expect(bracketSizeFor(150)).toBe(256);
    expect(roundCountFor(150)).toBe(8);
    expect(byeCountFor(150)).toBe(106);
    expect(firstRoundMatchCountFor(150)).toBe(22);
    expect(byeCountFor(64)).toBe(0);
    expect(firstRoundMatchCountFor(64)).toBe(32);
  });
});

describe("Fisher-Yates shuffle", () => {
  it("preserves all elements without changing the input", () => {
    const input = Object.freeze(entries(16));
    const shuffled = shuffle(input, () => 0);
    expect(shuffled).toHaveLength(input.length);
    expect(new Set(shuffled).size).toBe(input.length);
    expect([...shuffled].sort()).toEqual([...input].sort());
    expect(input).toEqual(entries(16));
    expect(shuffled).not.toBe(input);
  });

  it("uses the injected RNG and rejects an invalid index", () => {
    const calls: number[] = [];
    expect(shuffle([1, 2, 3, 4], (max) => { calls.push(max); return 0; })).toEqual([2, 3, 4, 1]);
    expect(calls).toEqual([4, 3, 2]);
    expect(() => shuffle([1, 2], () => 2)).toThrow(RangeError);
  });
});

describe("bracket generation", () => {
  it.each(sizes)("builds a connected single-elimination tree for %i entries", (size) => {
    const source = entries(size);
    const bracket = generateBracket(source, { randomIndex: noSwap });
    const byId = new Map(bracket.matches.map((match) => [match.id, match]));

    expect(bracket.matches).toHaveLength(size - 1);
    expect(source).toEqual(entries(size));

    // Every participant is seeded exactly once, wherever it enters the bracket.
    const seeded = bracket.matches.flatMap((match) =>
      [match.participantAId, match.participantBId].filter((id): id is string => id !== null));
    expect([...seeded].sort()).toEqual([...source].sort());

    // Exactly one final, and it closes the last round.
    const finals = bracket.matches.filter((match) => match.nextMatchId === null);
    expect(finals).toHaveLength(1);
    expect(finals[0].nextSlot).toBeNull();
    expect(finals[0].roundNumber).toBe(roundCountFor(size));

    // Every slot has exactly one source: a seeded entry or one incoming link.
    const feeders = new Map<string, BracketMatch>();
    for (const match of bracket.matches) {
      if (match.nextMatchId === null) continue;
      const next = byId.get(match.nextMatchId);
      expect(next?.roundNumber).toBe(match.roundNumber + 1);
      const key = `${match.nextMatchId}:${match.nextSlot}`;
      expect(feeders.has(key)).toBe(false);
      feeders.set(key, match);
    }
    for (const match of bracket.matches) {
      for (const slot of ["a", "b"] as const) {
        const seededHere = slot === "a" ? match.participantAId : match.participantBId;
        expect(seededHere !== null).toBe(!feeders.has(`${match.id}:${slot}`));
      }
    }

    // Round sizes: a short preliminary round, then a full power-of-two bracket.
    const perRound = new Map<number, number>();
    for (const match of bracket.matches) perRound.set(match.roundNumber, (perRound.get(match.roundNumber) ?? 0) + 1);
    expect(perRound.get(1)).toBe(firstRoundMatchCountFor(size));
    for (let round = 2; round <= roundCountFor(size); round++) {
      expect(perRound.get(round)).toBe(bracketSizeFor(size) / 2 ** round);
    }
    expect(bracket.matches.filter((match) => match.roundNumber > 2)
      .every((match) => match.participantAId === null && match.participantBId === null)).toBe(true);
  });

  it("gives every entry a unique match ID", () => {
    const bracket = generateBracket(entries(150));
    expect(new Set(bracket.matches.map((match) => match.id)).size).toBe(149);
  });

  it("rejects missing or repeated entry IDs", () => {
    expect(() => generateBracket(["a", "b", "c", "c"])).toThrow();
    expect(() => generateBracket(["a", "b", "c", " "])).toThrow();
  });
});

/** Plays the whole bracket out, always picking whoever sits in slot A. */
function playOut(initial: BracketState) {
  let state = initial;
  while (state.status === "active") {
    const next = state.matches.find((match) =>
      !match.winnerEntryId && match.participantAId && match.participantBId);
    if (!next) throw new Error("The bracket stalled with no playable match.");
    state = advanceWinner(state, next.id, next.participantAId!);
  }
  return state;
}

describe("advancing winners", () => {
  const start = () => generateBracket(entries(4), { randomIndex: noSwap });

  it("advances each winner into the correct slot without mutating the earlier state", () => {
    const initial = start();
    const first = initial.matches.find((match) => match.roundNumber === 1 && match.position === 1)!;
    const second = initial.matches.find((match) => match.roundNumber === 1 && match.position === 2)!;
    const afterFirst = advanceWinner(initial, first.id, first.participantBId!);
    const afterSecond = advanceWinner(afterFirst, second.id, second.participantAId!);
    const final = afterSecond.matches.find((match) => match.roundNumber === 2)!;
    expect(final.participantAId).toBe(first.participantBId);
    expect(final.participantBId).toBe(second.participantAId);
    expect(initial.matches.find((match) => match.id === first.id)?.winnerEntryId).toBeNull();
    expect(initial.matches.find((match) => match.id === final.id)?.participantAId).toBeNull();
    expect(afterSecond.status).toBe("active");
  });

  it("rejects an unrelated participant and a second choice", () => {
    const initial = start();
    const match = initial.matches[0];
    expect(() => advanceWinner(initial, match.id, "not-an-entry")).toThrow();
    const resolved = advanceWinner(initial, match.id, match.participantAId!);
    expect(() => advanceWinner(resolved, match.id, match.participantBId!)).toThrow();
  });

  it("requires both participants before resolving a later round", () => {
    const initial = start();
    const final = initial.matches.at(-1)!;
    expect(() => advanceWinner(initial, final.id, "entry-1")).toThrow();
  });

  it.each(sizes)("crowns exactly one champion after %i-entry Cup is played out", (size) => {
    const played = playOut(generateBracket(entries(size), { randomIndex: noSwap }));
    expect(played.status).toBe("completed");
    expect(played.championEntryId).toBeTruthy();
    expect(played.matches.every((match) => match.winnerEntryId !== null)).toBe(true);
    expect(played.matches.filter((match) => match.nextMatchId === null)[0].winnerEntryId)
      .toBe(played.championEntryId);
    expect(() => advanceWinner(played, played.matches[0].id, "entry-1")).toThrow();
  });
});

describe("round labels", () => {
  it("names the closing rounds and flags a preliminary round", () => {
    const labels = roundLabels(generateBracket(entries(150), { randomIndex: noSwap }).matches
      .map((match) => ({ round_number: match.roundNumber })));
    expect(labels.get(1)).toBe("Ronda preliminar");
    expect(labels.get(2)).toBe("Ronda 2");
    expect(labels.get(5)).toBe("Octavos de final");
    expect(labels.get(6)).toBe("Cuartos de final");
    expect(labels.get(7)).toBe("Semifinales");
    expect(labels.get(8)).toBe("Final");
  });

  it("leaves a power-of-two Cup without a preliminary round", () => {
    const labels = roundLabels(generateBracket(entries(8), { randomIndex: noSwap }).matches
      .map((match) => ({ round_number: match.roundNumber })));
    expect(labels.get(1)).toBe("Cuartos de final");
    expect(labels.get(3)).toBe("Final");
  });
});
