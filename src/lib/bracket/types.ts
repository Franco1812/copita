export type NextSlot = "a" | "b";

export type BracketMatch = {
  id: string;
  roundNumber: number;
  position: number;
  participantAId: string | null;
  participantBId: string | null;
  winnerEntryId: string | null;
  nextMatchId: string | null;
  nextSlot: NextSlot | null;
};

export type BracketState = {
  matches: BracketMatch[];
  status: "active" | "completed";
  championEntryId: string | null;
};
