import { randomInt } from "node:crypto";

export type RandomIndex = (maxExclusive: number) => number;

/** Returns a new array. Production uses Node's cryptographic randomInt. */
export function shuffle<T>(items: readonly T[], randomIndex: RandomIndex = randomInt): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = randomIndex(index + 1);
    if (!Number.isInteger(swapIndex) || swapIndex < 0 || swapIndex > index) {
      throw new RangeError("The RNG returned an invalid index.");
    }
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}
