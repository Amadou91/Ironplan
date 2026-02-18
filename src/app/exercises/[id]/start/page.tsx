'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
export default function ExerciseStartRedirectPage() {
  const params = useParams()
  const router = useRouter()

  useEffect(() => {
    if (!params.id) return
    const templateId = Array.isArray(params.id) ? params.id[0] : params.id
    if (!templateId) return
    router.replace(`/workout/${templateId}?start=1`)
  }, [params.id, router])

  return <div className="page-shell p-10 text-center text-muted">Redirecting to session setup…</div>
}
