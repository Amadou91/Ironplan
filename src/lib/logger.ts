type LogLevel = 'info' | 'warn' | 'error'

export const logEvent = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
  const payload = meta ? { message, ...meta } : { message }
  if (level === 'error') {
    console.error(payload)
    return
  }
  if (level === 'warn') {
    console.warn(payload)
    return
  }
  console.info(payload)
}
