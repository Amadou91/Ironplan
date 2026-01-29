/**
 * Seeded random number generation utilities.
 * Provides deterministic randomness for reproducible workout generation.
 */

/**
 * Creates a hash from a seed string using FNV-1a algorithm.
 * @param seed - The seed string
 * @returns 32-bit unsigned hash
 */
export const hashSeed = (seed: string): number => {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/**
 * Creates a seeded random number generator.
 * Returns consistent sequences for the same seed.
 * @param seed - The seed string
 * @returns Function that returns random numbers [0, 1)
 */
export const createSeededRandom = (seed: string): (() => number) => {
  let state = hashSeed(seed)
  return () => {
    state += 0x6d2b79f5
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
