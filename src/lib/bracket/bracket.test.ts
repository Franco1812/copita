import { describe, expect, it } from "vitest";
import { advanceWinner } from "./advanceWinner";
import { generateBracket } from "./generateBracket";
import { ALLOWED_BRACKET_SIZES, isAllowedBracketSize } from "./sizes";
import { shuffle } from "./shuffle";
import type { BracketState } from "./types";

const entries = (count: number) => Array.from({ length: count }, (_, index) => `entry-${index + 1}`);
const noSwap = (maxExclusive: number) => maxExclusive - 1;

describe("bracket sizes", () => {
  it.each(ALLOWED_BRACKET_SIZES)("accepts %i", (size) => {
    expect(isAllowedBracketSize(size)).toBe(true);
  });

  it.each([0, 2, 6, 10, 12, 24, 100])("rejects %i", (size) => {
    expect(isAllowedBracketSize(size)).toBe(false);
    expect(() => generateBracket(entries(size))).toThrow(RangeError);
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
  it.each(ALLOWED_BRACKET_SIZES)("builds a connected bracket for %i entries", (size) => {
    const source = entries(size);
    const bracket = generateBracket(source, { randomIndex: noSwap });
    const firstRound = bracket.matches.filter((match) => match.roundNumber === 1);
    const final = bracket.matches.filter((match) => match.nextMatchId === null);
    expect(bracket.matches).toHaveLength(size - 1);
    expect(firstRound).toHaveLength(size / 2);
    expect(firstRound.flatMap((match) => [match.participantAId, match.participantBId])).toEqual(source);
    expect(final).toHaveLength(1);
    expect(final[0].nextSlot).toBeNull();
    expect(bracket.matches.filter((match) => match.nextMatchId !== null)).toHaveLength(size - 2);
    for (const match of bracket.matches) {
      if (match.nextMatchId !== null) {
        const next = bracket.matches.find((candidate) => candidate.id === match.nextMatchId);
        expect(next?.roundNumber).toBe(match.roundNumber + 1);
        expect(next?.position).toBe(Math.ceil(match.position / 2));
        expect(match.nextSlot).toBe(match.position % 2 === 1 ? "a" : "b");
      } else {
        expect(match.roundNumber).toBe(Math.log2(size));
      }
    }
    expect(bracket.matches.filter((match) => match.roundNumber > 1).every((match) =>
      match.participantAId === null && match.participantBId === null)).toBe(true);
    expect(source).toEqual(entries(size));
  });

  it("rejects missing or repeated entry IDs", () => {
    expect(() => generateBracket(["a", "b", "c", "c"])).toThrow();
    expect(() => generateBracket(["a", "b", "c", " "])).toThrow();
  });
});

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

  it("completes the run only when the final is resolved", () => {
    let state: BracketState = start();
    for (const roundNumber of [1, 2]) {
      const matches = state.matches.filter((match) => match.roundNumber === roundNumber);
      for (const match of matches) state = advanceWinner(state, match.id, match.participantAId!);
    }
    expect(state.status).toBe("completed");
    expect(state.championEntryId).toBe("entry-1");
    expect(() => advanceWinner(state, state.matches[0].id, "entry-1")).toThrow();
  });
});
