/**
 * Shared date formatting and manipulation utilities.
 * This module centralizes date operations to avoid duplication across components.
 */

/**
 * Formats a Date object as YYYY-MM-DD string for HTML date inputs.
 * @param value - The Date to format
 * @returns Formatted date string
 */
export const formatDateForInput = (value: Date): string => {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Formats a date string for display (locale-aware).
 * Handles ISO strings and date-only strings correctly.
 * @param value - The date string to format
 * @returns Formatted date string for display
 */
export const formatDate = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  // Handle date-only strings to avoid timezone shifts
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) || value.endsWith('T00:00:00.000Z') || value.endsWith('T00:00:00Z')) {
    const [year, month, day] = value.split('T')[0].split('-').map(Number)
    const localDate = new Date(year, month - 1, day)
    return localDate.toLocaleDateString()
  }
  return date.toLocaleDateString()
}

/**
 * Formats a date string with time for display (locale-aware).
 * @param value - The date string to format
 * @returns Formatted date and time string
 */
export const formatDateTime = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) || value.endsWith('T00:00:00.000Z') || value.endsWith('T00:00:00Z')) {
    const [year, month, day] = value.split('T')[0].split('-').map(Number)
    const localDate = new Date(year, month - 1, day)
    return localDate.toLocaleDateString([], { dateStyle: 'medium' })
  }
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

/**
 * Formats duration between two timestamps as "X min".
 * @param start - Start timestamp
 * @param end - End timestamp
 * @returns Formatted duration string or 'N/A'
 */
export const formatDuration = (start?: string | null, end?: string | null): string => {
  if (!start || !end) return 'N/A'
  const startDate = new Date(start)
  const endDate = new Date(end)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 'N/A'
  const diff = Math.max(0, endDate.getTime() - startDate.getTime())
  const minutes = Math.round(diff / 60000)
  return `${minutes} min`
}

/**
 * Formats a date for chart axis labels (e.g., "Jan 15").
 * @param value - Date string or timestamp
 * @returns Short formatted date
 */
export const formatChartDate = (value: string | number): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/**
 * Returns ISO week key for a date (e.g., "2024-W03").
 * Useful for grouping data by week.
 * @param value - Date string
 * @returns Week key string
 */
export const getWeekKey = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = temp.getUTCDay() || 7
  temp.setUTCDate(temp.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((temp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${temp.getUTCFullYear()}-W${week}`
}

/**
 * Calculates the number of days between two dates.
 * @param date1 - First date
 * @param date2 - Second date
 * @returns Number of days between dates
 */
export const daysBetween = (date1: Date, date2: Date): number => {
  const oneDay = 24 * 60 * 60 * 1000
  return Math.round(Math.abs((date1.getTime() - date2.getTime()) / oneDay))
}
