'use client'

import { useEffect, useState } from 'react'

/**
 * Detects whether the app is running in PWA standalone mode
 * (home-screen icon on iOS / installed PWA on Android/desktop).
 *
 * In standalone mode the desktop sidebar is suppressed so
 * touch-first mobile navigation is used at every viewport width.
 */
export function useIsStandalone(): boolean {
  const [standalone, setStandalone] = useState(() => {
    if (typeof window === 'undefined') return false
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
    )
  })

  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)')
    const onChange = (e: MediaQueryListEvent) => setStandalone(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return standalone
}
