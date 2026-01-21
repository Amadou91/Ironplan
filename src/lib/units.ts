import type { WeightUnit } from '@/types/domain'

export const LBS_PER_KG = 2.20462

export const convertWeight = (value: number, fromUnit: WeightUnit, toUnit: WeightUnit) => {
  if (!Number.isFinite(value) || fromUnit === toUnit) return value
  return fromUnit === 'kg' ? value * LBS_PER_KG : value / LBS_PER_KG
}

export const roundWeight = (value: number, fractionDigits = 1) => {
  if (!Number.isFinite(value)) return value
  const factor = 10 ** fractionDigits
  return Math.round(value * factor) / factor
}
