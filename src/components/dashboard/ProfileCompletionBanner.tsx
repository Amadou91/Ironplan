'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, X, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/authStore'
import {
  validateProfileCompletion,
  type ProfileSnapshot,
} from '@/lib/profile-validation'
import { normalizePreferences } from '@/lib/preferences'

export function ProfileCompletionBanner() {
  const user = useAuthStore((state) => state.user)
  const [missingCount, setMissingCount] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (!user) return

    const DISMISS_KEY = `profile-banner-dismissed-${user.id}`
    if (sessionStorage.getItem(DISMISS_KEY)) {
      setDismissed(true)
      setLoaded(true)
      return
    }

    const check = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('weight_lb, height_in, birthdate, sex, preferences')
        .eq('id', user.id)
        .maybeSingle()

      if (!data) {
        setLoaded(true)
        return
      }

      const prefs = normalizePreferences(data.preferences)
      const inventory = prefs.equipment?.inventory
      const hasEquipment = inventory
        ? Object.entries(inventory).some(([key, v]) => {
            if (key === 'machines') return Object.values(v as Record<string, boolean>).some(Boolean)
            if (Array.isArray(v)) return v.length > 0
            if (key === 'barbell') return (v as { available: boolean }).available
            return Boolean(v)
          })
        : false

      const snapshot: ProfileSnapshot = {
        weight_lb: data.weight_lb,
        height_in: data.height_in,
        birthdate: data.birthdate,
        sex: data.sex,
        hasEquipment,
      }

      const result = validateProfileCompletion(snapshot)
      setMissingCount(result.missingFields.length)
      setLoaded(true)
    }

    void check()
  }, [user, supabase])

  const handleDismiss = () => {
    if (user) {
      sessionStorage.setItem(`profile-banner-dismissed-${user.id}`, '1')
    }
    setDismissed(true)
  }

  if (!loaded || dismissed || missingCount === 0) return null

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-[var(--color-warning-border,#d97706)] bg-[var(--color-warning-soft,#fef3c7)] px-4 py-3 text-sm"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-warning,#d97706)]" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[var(--color-warning-strong,#92400e)]">
          {missingCount === 1 ? '1 profile field missing' : `${missingCount} profile fields missing`}
        </p>
        <p className="mt-0.5 text-xs text-[var(--color-warning-strong,#92400e)]/80">
          Completing your profile improves calculations, charts, and recommendations.
        </p>
      </div>
      <Link
        href="/profile"
        className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-[var(--color-warning-strong,#92400e)] transition-colors hover:bg-[var(--color-warning,#d97706)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-warning,#d97706)]"
        aria-label="Complete your profile"
      >
        Complete <ChevronRight className="h-3 w-3" />
      </Link>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss profile warning"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--color-warning-strong,#92400e)]/60 transition-colors hover:bg-[var(--color-warning,#d97706)]/10 hover:text-[var(--color-warning-strong,#92400e)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-warning,#d97706)]"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
