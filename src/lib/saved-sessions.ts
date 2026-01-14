export type SavedSessionConflict = {
  dayOfWeek: number
  sessionId: string
  sessionName: string
  updatedAt: string | null
}

type ExistingSessionRow = {
  id: string
  day_of_week: number
  session_name: string
  updated_at: string | null
}

export const resolveSavedSessionConflicts = (
  selectedDays: number[],
  existingSessions: ExistingSessionRow[]
) => {
  const selectedDaySet = new Set(selectedDays)
  const relevantSessions = existingSessions.filter((session) => selectedDaySet.has(session.day_of_week))
  const conflicts: SavedSessionConflict[] = []
  const conflictDays = new Set(relevantSessions.map((session) => session.day_of_week))

  for (const session of relevantSessions) {
    conflicts.push({
      dayOfWeek: session.day_of_week,
      sessionId: session.id,
      sessionName: session.session_name,
      updatedAt: session.updated_at
    })
  }

  return {
    conflicts,
    availableDays: selectedDays.filter((day) => !conflictDays.has(day))
  }
}
