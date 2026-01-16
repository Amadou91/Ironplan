export const promptForSessionMinutes = (defaultMinutes = 45) => {
  if (typeof window === 'undefined') return null
  const response = window.prompt(
    'How much time do you have available today? (20-120 minutes)',
    String(defaultMinutes)
  )
  if (response === null) return null
  const minutes = Number.parseInt(response, 10)
  if (!Number.isFinite(minutes) || minutes < 20 || minutes > 120) {
    window.alert('Please enter a number between 20 and 120 minutes.')
    return null
  }
  return minutes
}
