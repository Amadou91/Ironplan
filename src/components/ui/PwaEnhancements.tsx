'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download, Wifi, WifiOff } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function PwaEnhancements() {
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.navigator.onLine
  })
  const [isStandalone, setIsStandalone] = useState(() => {
    if (typeof window === 'undefined') return false
    const displayModeStandalone = window.matchMedia('(display-mode: standalone)').matches
    const iosStandalone = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
    return displayModeStandalone || iosStandalone
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    if (!window.isSecureContext) return
    if (process.env.NODE_ENV !== 'production') return

    const registerServiceWorker = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      } catch {
        // no-op
      }
    }

    void registerServiceWorker()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPromptEvent(event as BeforeInstallPromptEvent)
    }

    const onInstalled = () => {
      setInstallPromptEvent(null)
      setIsStandalone(true)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const showInstallButton = useMemo(
    () => Boolean(installPromptEvent) && !isStandalone,
    [installPromptEvent, isStandalone]
  )

  const handleInstallClick = async () => {
    if (!installPromptEvent) return

    try {
      await installPromptEvent.prompt()
      const outcome = await installPromptEvent.userChoice
      if (outcome.outcome !== 'accepted') return
      setInstallPromptEvent(null)
    } catch {
      // no-op
    }
  }

  return (
    <>
      {!isOnline && (
        <div className="fixed left-4 right-4 top-3 z-[var(--z-toast)] mx-auto max-w-md rounded-xl border border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] px-3 py-2 shadow-[var(--shadow-md)]">
          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[var(--color-danger)]">
            <WifiOff size={14} />
            Offline mode: continue logging. Some updates may sync when connection returns.
          </div>
        </div>
      )}

      {isOnline && isStandalone && (
        <div className="fixed right-4 top-3 z-[var(--z-toast)] rounded-full border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-1.5 shadow-[var(--shadow-sm)]">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            <Wifi size={12} />
            PWA Ready
          </span>
        </div>
      )}

      {showInstallButton && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-4 z-[var(--z-toast)] lg:bottom-6">
          <button
            type="button"
            onClick={handleInstallClick}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--color-primary-border)] bg-[var(--color-primary-soft)] px-4 py-2 text-sm font-semibold text-[var(--color-primary-strong)] shadow-[var(--shadow-md)] transition-all hover:-translate-y-0.5 hover:shadow-lg"
            aria-label="Install Ironplan app"
          >
            <Download size={16} />
            Install App
          </button>
        </div>
      )}
    </>
  )
}
