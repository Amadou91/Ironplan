'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Download, RefreshCcw, WifiOff, X } from 'lucide-react'

const PWA_WELCOMED_KEY = 'ironplan:pwa-welcomed'
const PWA_INSTALL_HINT_DISMISSED_KEY = 'ironplan:pwa-install-hint-dismissed'

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
  const [showWelcome, setShowWelcome] = useState(() => {
    if (typeof window === 'undefined') return false
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
    if (!standalone) return false
    try {
      if (localStorage.getItem(PWA_WELCOMED_KEY)) return false
      localStorage.setItem(PWA_WELCOMED_KEY, '1')
      return true
    } catch {
      return false
    }
  })
  const [showInstallHint, setShowInstallHint] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return !localStorage.getItem(PWA_INSTALL_HINT_DISMISSED_KEY)
    } catch {
      return true
    }
  })
  const [showUpdateReady, setShowUpdateReady] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const showManualInstallHint = useMemo(() => {
    if (typeof window === 'undefined') return false
    if (isStandalone || !showInstallHint) return false

    const ua = window.navigator.userAgent.toLowerCase()
    const isIos = /iphone|ipad|ipod/.test(ua)
    const isSafari = /safari/.test(ua) && !/crios|fxios|edgios/.test(ua)
    return isIos && isSafari && !installPromptEvent
  }, [installPromptEvent, isStandalone, showInstallHint])

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

  useEffect(() => {
    if (!showWelcome) return
    const timer = setTimeout(() => setShowWelcome(false), 3000)
    return () => clearTimeout(timer)
  }, [showWelcome])

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    let updateInterval: ReturnType<typeof setInterval> | null = null

    const monitorRegistration = async () => {
      const registration = await navigator.serviceWorker.getRegistration()
      if (!registration) return

      if (registration.waiting) {
        setShowUpdateReady(true)
      }

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setShowUpdateReady(true)
          }
        })
      })

      updateInterval = setInterval(() => {
        registration.update().catch(() => undefined)
      }, 5 * 60 * 1000)
    }

    void monitorRegistration()

    return () => {
      if (updateInterval) clearInterval(updateInterval)
    }
  }, [])

  const showInstallButton = useMemo(
    () => Boolean(installPromptEvent) && !isStandalone,
    [installPromptEvent, isStandalone]
  )

  const dismissInstallHint = useCallback(() => {
    setShowInstallHint(false)
    try {
      localStorage.setItem(PWA_INSTALL_HINT_DISMISSED_KEY, '1')
    } catch {
      // no-op
    }
  }, [])

  const handleInstallClick = useCallback(async () => {
    if (!installPromptEvent) return

    try {
      await installPromptEvent.prompt()
      const outcome = await installPromptEvent.userChoice
      if (outcome.outcome !== 'accepted') return
      setInstallPromptEvent(null)
    } catch {
      // no-op
    }
  }, [installPromptEvent])

  const handleApplyUpdate = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return
    setIsRefreshing(true)

    const registration = await navigator.serviceWorker.getRegistration()
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      setTimeout(() => window.location.reload(), 400)
      return
    }

    await registration?.update()
    window.location.reload()
  }, [])

  return (
    <>
      {!isOnline && (
        <div className="fixed left-3 right-3 top-[calc(env(safe-area-inset-top)_+_0.5rem)] z-[var(--z-toast)] mx-auto max-w-lg rounded-2xl border border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] px-3 py-2.5 shadow-[var(--shadow-md)]">
          <div className="flex items-center justify-between gap-3 text-xs font-semibold text-[var(--color-danger)]">
            <span className="inline-flex items-center gap-2">
              <WifiOff size={14} />
              Offline mode: keep logging. We will sync once reconnected.
            </span>
            <Link href="/offline" className="rounded-md px-2 py-1 text-[10px] uppercase tracking-wider hover:bg-[var(--color-danger)]/10">
              Details
            </Link>
          </div>
        </div>
      )}

      {showWelcome && (
        <div className="fixed right-4 top-[calc(env(safe-area-inset-top)_+_0.75rem)] z-[var(--z-toast)] animate-fade-in rounded-full border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-1.5 shadow-[var(--shadow-sm)] transition-opacity duration-500">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            App installed
          </span>
        </div>
      )}

      {showUpdateReady && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+9.25rem)] left-4 right-4 z-[var(--z-toast)] mx-auto max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-lg)] lg:bottom-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-strong">Update available</p>
              <p className="text-xs text-muted">Refresh for the latest fixes and offline cache updates.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowUpdateReady(false)}
              className="rounded-lg p-1.5 text-muted transition-colors hover:bg-[var(--color-surface-muted)] hover:text-strong"
              aria-label="Dismiss update notice"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => void handleApplyUpdate()}
            disabled={isRefreshing}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-primary-border)] bg-[var(--color-primary-soft)] px-4 py-2 text-sm font-semibold text-[var(--color-primary-strong)] transition-colors hover:bg-[var(--color-primary-soft)]/80 disabled:opacity-60"
          >
            <RefreshCcw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Refreshing...' : 'Refresh now'}
          </button>
        </div>
      )}

      {showManualInstallHint && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+9.25rem)] left-4 right-4 z-[var(--z-toast)] mx-auto max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-lg)] lg:bottom-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-strong">Install Ironplan</p>
              <p className="text-xs text-muted">
                On iPhone/iPad Safari, tap Share then Add to Home Screen for the full app experience.
              </p>
            </div>
            <button
              type="button"
              onClick={dismissInstallHint}
              className="rounded-lg p-1.5 text-muted transition-colors hover:bg-[var(--color-surface-muted)] hover:text-strong"
              aria-label="Dismiss install hint"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
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
