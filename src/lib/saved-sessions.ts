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
  const conflicts: SavedSessionConflict[] = []
  const conflictDays = new Set(existingSessions.map((session) => session.day_of_week))

  for (const session of existingSessions) {
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
