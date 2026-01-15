import type { CardioActivity } from '@/types/domain'

export const CARDIO_ACTIVITY_OPTIONS: Array<{ value: CardioActivity; label: string; keywords: string[] }> = [
  { value: 'skipping', label: 'Skipping', keywords: ['skipping', 'jump rope'] },
  { value: 'indoor_cycling', label: 'Indoor Cycling', keywords: ['indoor cycling', 'spin', 'assault bike'] },
  { value: 'outdoor_cycling', label: 'Outdoor Cycling', keywords: ['outdoor cycling', 'road cycling', 'bike ride'] },
  { value: 'running', label: 'Running', keywords: ['run', 'treadmill'] },
  { value: 'rowing', label: 'Rowing', keywords: ['row'] }
]

const cardioKeywordMap = new Map(CARDIO_ACTIVITY_OPTIONS.map((option) => [option.value, option.keywords]))

export const matchesCardioSelection = (exerciseName: string, selected: CardioActivity[]) => {
  if (selected.length === 0) return true
  const normalizedName = exerciseName.toLowerCase()
  return selected.some((activity) => {
    const keywords = cardioKeywordMap.get(activity) ?? []
    return keywords.some((keyword) => normalizedName.includes(keyword))
  })
}
