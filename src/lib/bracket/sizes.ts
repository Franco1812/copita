export const MIN_PARTICIPANTS = 4;
export const MAX_PARTICIPANTS = 150;

/** Shown as quick picks in the Cup forms; any number in range is still valid. */
export const SUGGESTED_PARTICIPANT_COUNTS = [8, 16, 32, 64, 100, 128, 150] as const;

export function isAllowedParticipantCount(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_PARTICIPANTS && value <= MAX_PARTICIPANTS;
}

/** Smallest power of two that fits the Cup; the extra slots become byes. */
export function bracketSizeFor(participants: number): number {
  let size = 1;
  while (size < participants) size *= 2;
  return size;
}

export function roundCountFor(participants: number): number {
  let rounds = 0;
  for (let size = 1; size < participants; size *= 2) rounds++;
  return rounds;
}

/** Participants that skip the preliminary round because the Cup is not a power of two. */
export function byeCountFor(participants: number): number {
  return bracketSizeFor(participants) - participants;
}

/** Matches played in the preliminary round; the rest of the bracket is a full power of two. */
export function firstRoundMatchCountFor(participants: number): number {
  return participants - bracketSizeFor(participants) / 2;
}
