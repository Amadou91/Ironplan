type SupabaseEnv = {
  url: string
  anonKey: string
}

export function getSupabaseEnv(): SupabaseEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const missing: string[] = []

  if (!url) {
    missing.push('NEXT_PUBLIC_SUPABASE_URL')
  }

  if (!anonKey) {
    missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing Supabase environment variables: ${missing.join(
        ', '
      )}. See .env.example for required values.`
    )
  }

  return { url, anonKey }
}
