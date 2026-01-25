export const calculateAge = (birthdate?: string | null) => {
  if (!birthdate) return null
  const date = new Date(birthdate)
  if (Number.isNaN(date.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - date.getFullYear()
  const monthDelta = now.getMonth() - date.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < date.getDate())) {
    age -= 1
  }
  return age
}

export const calculateBmi = (weightLb?: number | null, heightIn?: number | null) => {
  if (!weightLb || !heightIn) return null
  if (weightLb <= 0 || heightIn <= 0) return null
  return (weightLb / (heightIn * heightIn)) * 703
}

export const calculateBmr = (
  weightLb?: number | null,
  heightIn?: number | null,
  age?: number | null,
  sex?: string | null
) => {
  if (!weightLb || !heightIn || typeof age !== 'number') return null
  if (!sex || (sex !== 'male' && sex !== 'female')) return null
  const weightKg = weightLb / 2.20462
  const heightCm = heightIn * 2.54
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return sex === 'male' ? base + 5 : base - 161
}

export const formatHeightFromInches = (heightIn?: number | null) => {
  if (typeof heightIn !== 'number' || !Number.isFinite(heightIn) || heightIn <= 0) return ''
  const rounded = Math.round(heightIn)
  const feet = Math.floor(rounded / 12)
  const inches = rounded - feet * 12
  if (feet <= 0) return `${rounded} in`
  return `${feet}' ${inches}"`
}
