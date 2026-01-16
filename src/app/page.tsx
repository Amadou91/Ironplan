'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'

export default function Home() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const hydrated = useAuthStore((state) => state.hydrated)

  useEffect(() => {
    if (!hydrated) return
    router.replace(user ? '/dashboard' : '/auth/login')
  }, [hydrated, router, user])

  return (
    <div className="page-shell flex min-h-screen items-center justify-center text-sm text-muted">
      Redirecting…
    </div>
  )
}
