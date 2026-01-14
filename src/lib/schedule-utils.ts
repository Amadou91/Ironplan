const longDayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const shortDayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const formatDayLabel = (dayOfWeek: number, variant: 'short' | 'long' = 'long') => {
  const labels = variant === 'short' ? shortDayLabels : longDayLabels
  return labels[dayOfWeek] ?? 'Unknown'
}

export const getWeekStartDate = (date: Date = new Date()) => {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - start.getDay())
  return start
}

export const formatWeekStartDate = (date: Date = new Date()) => {
  const start = getWeekStartDate(date)
  return start.toISOString().slice(0, 10)
}
