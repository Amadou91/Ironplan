/**
 * Shared date formatting and manipulation utilities.
 * This module centralizes date operations to avoid duplication across components.
 */

const ET_TIMEZONE = 'America/New_York'

/**
 * Gets the current date/time in Eastern Time.
 */
export const getNowET = (): Date => {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: ET_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    fractionalSecondDigits: 3,
    hour12: false
  })
  
  const parts = formatter.formatToParts(now)
  const map: Record<string, any> = {}
  parts.forEach(p => { map[p.type] = p.value })
  
  // Create a Date object representing the ET wall-clock time
  return new Date(map.year, map.month - 1, map.day, map.hour, map.minute, map.second, map.fractionalSecond)
}

/**
 * Returns YYYY-MM-DD for the current day in Eastern Time.
 */
export const getTodayDateStringET = (): string => {
  return formatDateInET(new Date())
}

/**
 * Formats a Date object as YYYY-MM-DD string for HTML date inputs.
 * Uses local time.
 */
export const formatDateForInput = (value: Date): string => {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Formats a date string for display (locale-aware, forced to ET).
 */
export const formatDate = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  
  return date.toLocaleDateString('en-US', {
    timeZone: ET_TIMEZONE,
    month: 'numeric',
    day: 'numeric',
    year: 'numeric'
  })
}

/**
 * Formats a date string with time for display (locale-aware, forced to ET).
 */
export const formatDateTime = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  
  return date.toLocaleString('en-US', {
    timeZone: ET_TIMEZONE,
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

/**
 * Formats duration between two timestamps as "X min".
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
 * Uses ET for consistent labeling.
 */
export const formatChartDate = (value: string | number): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  
  return date.toLocaleDateString('en-US', {
    timeZone: ET_TIMEZONE,
    month: 'short',
    day: 'numeric'
  })
}

/**
 * Returns ISO week key for a date (e.g., "2024-W03") based on ET.
 */
export const getWeekKey = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  
  // Convert to ET string then parse back to get ET components
  const etStr = date.toLocaleString('en-CA', { timeZone: ET_TIMEZONE, hour12: false })
  const [datePart] = etStr.split(',')
  const [year, month, day] = datePart.split('-').map(Number)
  
  const temp = new Date(Date.UTC(year, month - 1, day))
  const dayOfWeek = temp.getUTCDay() || 7
  temp.setUTCDate(temp.getUTCDate() + 4 - dayOfWeek)
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((temp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${temp.getUTCFullYear()}-W${week}`
}

/**
 * Calculates the number of days between two dates.
 */
export const daysBetween = (date1: Date, date2: Date): number => {
  const oneDay = 24 * 60 * 60 * 1000
  return Math.round(Math.abs((date1.getTime() - date2.getTime()) / oneDay))
}

/**
 * Returns YYYY-MM-DD for a given date in Eastern Time.
 */
export const formatDateInET = (date: Date): string => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: ET_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  return formatter.format(date) // en-CA returns YYYY-MM-DD
}

/**
 * Converts an ET date string (YYYY-MM-DD) to a UTC range.
 * Useful for database queries where we want all sessions that occurred 
 * on that ET day.
 */
export const getUTCDateRangeFromET = (dateString: string) => {
  // We want to find the UTC time that corresponds to 00:00:00 and 23:59:59 in ET
  // A simple way is to use the fact that ET is either UTC-4 or UTC-5.
  // But for precision, we use the ET string and find the UTC offset.
  
  const getISOForETWallClock = (dtStr: string, timeStr: string) => {
    // Create a date that the browser thinks is UTC but contains the ET wall-clock values
    const [y, m, d] = dtStr.split('-').map(Number)
    const [hr, min, sec] = timeStr.split(':').map(Number)
    const mockUtc = new Date(Date.UTC(y, m - 1, d, hr, min, sec))
    
    // Now find what ET actually is at this UTC moment
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: ET_TIMEZONE,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false
    })
    
    const parts = formatter.formatToParts(mockUtc)
    const map: any = {}
    parts.forEach(p => map[p.type] = p.value)
    
    // The "error" between our mock UTC and the actual ET
    const etWallClockAsUtc = new Date(Date.UTC(map.year, map.month - 1, map.day, map.hour, map.minute, map.second))
    const offset = etWallClockAsUtc.getTime() - mockUtc.getTime()
    
    return new Date(mockUtc.getTime() - offset).toISOString()
  }

  return {
    start: getISOForETWallClock(dateString, '00:00:00'),
    end: getISOForETWallClock(dateString, '23:59:59')
  }
}
