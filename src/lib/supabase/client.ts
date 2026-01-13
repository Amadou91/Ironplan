'use client'

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Allow builds/tests to run in environments without Supabase configured (e.g., Codex)
  if (!url || !key) return null

  return createBrowserClient(url, key)
}
