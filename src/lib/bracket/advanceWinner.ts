import type { BracketState } from "./types";

/** Applies one irreversible choice without mutating the prior state. */
export function advanceWinner(state: BracketState, matchId: string, winnerEntryId: string): BracketState {
  if (state.status !== "active") throw new Error("The run is already completed.");
  const match = state.matches.find((candidate) => candidate.id === matchId);
  if (!match) throw new Error("Match not found.");
  if (match.winnerEntryId !== null) throw new Error("This match already has a winner.");
  if (match.participantAId === null || match.participantBId === null) {
    throw new Error("Both participants must be present.");
  }
  if (winnerEntryId !== match.participantAId && winnerEntryId !== match.participantBId) {
    throw new Error("The winner must be one of the match participants.");
  }

  if (match.nextMatchId === null) {
    if (match.nextSlot !== null) throw new Error("Final match has an invalid next slot.");
    return {
      status: "completed",
      championEntryId: winnerEntryId,
      matches: state.matches.map((candidate) => candidate.id === matchId
        ? { ...candidate, winnerEntryId } : candidate),
    };
  }

  if (match.nextSlot === null) throw new Error("Next match slot is missing.");
  const next = state.matches.find((candidate) => candidate.id === match.nextMatchId);
  if (!next || next.roundNumber !== match.roundNumber + 1 || next.position !== Math.ceil(match.position / 2)) {
    throw new Error("Invalid next match.");
  }
  const slot = match.nextSlot === "a" ? "participantAId" : "participantBId";
  if (next[slot] !== null || next.winnerEntryId !== null) {
    throw new Error("The next match slot is already filled.");
  }

  return {
    ...state,
    matches: state.matches.map((candidate) => {
      if (candidate.id === matchId) return { ...candidate, winnerEntryId };
      if (candidate.id === next.id) return { ...candidate, [slot]: winnerEntryId };
      return candidate;
    }),
  };
}
