/**
 * Shared mathematical utility functions.
 * This module centralizes common math operations to avoid duplication.
 */

/**
 * Clamps a value between a minimum and maximum bound.
 * @param value - The value to clamp
 * @param min - The minimum bound
 * @param max - The maximum bound
 * @returns The clamped value
 */
export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

/**
 * Checks if a value is a valid finite number.
 * @param value - The value to check
 * @returns True if value is a finite number
 */
export const isValidNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

/**
 * Rounds a number to a specified number of decimal places.
 * @param value - The value to round
 * @param decimals - Number of decimal places (default: 2)
 * @returns The rounded value
 */
export const roundTo = (value: number, decimals = 2): number => {
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}

/**
 * Calculates a weighted average of values.
 * @param values - Array of values (null values are skipped)
 * @param weights - Array of weights for each value
 * @returns The weighted average, or null if no valid values
 */
export const weightedAverage = (
  values: Array<number | null>,
  weights: number[]
): number | null => {
  let total = 0
  let weightSum = 0
  values.forEach((value, index) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return
    const weight = Number.isFinite(weights[index]) && weights[index] > 0 ? weights[index] : 1
    total += value * weight
    weightSum += weight
  })
  if (!weightSum) return null
  return total / weightSum
}
