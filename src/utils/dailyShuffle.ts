/**
 * Posterealm Deterministic Daily Shuffle Utility
 * Standardized daily-random ordering across Collections catalog and Poster Kit Design Picker.
 * Uses local calendar date string (YYYY-MM-DD), 32-bit polynomial hash,
 * Mulberry32 PRNG, and Fisher-Yates shuffle algorithm.
 */

/**
 * Returns the current calendar date string in YYYY-MM-DD format using local time.
 */
export const getDailySeed = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Converts a date string (YYYY-MM-DD) into a deterministic 32-bit integer seed.
 */
export const getDailyNumericSeed = (dateStr: string): number => {
  let numericSeed = 0;
  for (let i = 0; i < dateStr.length; i++) {
    numericSeed = (numericSeed << 5) - numericSeed + dateStr.charCodeAt(i);
    numericSeed |= 0; // Convert to 32-bit integer
  }
  return numericSeed;
};

/**
 * Creates a seeded Mulberry32 pseudo-random number generator.
 */
export const createMulberry32 = (seed: number): (() => number) => {
  let s = seed;
  return () => {
    let t = (s += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Deterministically shuffles an array using the Mulberry32 PRNG and Fisher-Yates algorithm
 * seeded by the specified date string (or today's seed).
 */
export const shuffleWithDailySeed = <T>(
  items: readonly T[],
  dateStr: string = getDailySeed()
): T[] => {
  if (items.length <= 1) return [...items];

  let numericSeed = getDailyNumericSeed(dateStr);
  const random = () => {
    let t = (numericSeed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }
  return shuffled;
};
