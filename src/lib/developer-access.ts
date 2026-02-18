import type { SupabaseClient, User } from '@supabase/supabase-js'

export const DEVELOPER_TOOLS_ALLOWED_EMAILS = ['johnborban@gmail.com'] as const

const developerEmailSet = new Set(
  DEVELOPER_TOOLS_ALLOWED_EMAILS.map((email) => email.trim().toLowerCase())
)

const EXERCISE_EDIT_PATH_PATTERN = /^\/exercises\/[^/]+\/edit\/?$/

export function normalizeEmail(email?: string | null): string {
  return (email ?? '').trim().toLowerCase()
}

export function isDeveloperToolsUser(email?: string | null): boolean {
  const normalizedEmail = normalizeEmail(email)
  return normalizedEmail.length > 0 && developerEmailSet.has(normalizedEmail)
}

export function isDeveloperRoute(pathname: string): boolean {
  if (pathname === '/exercises' || pathname === '/exercises/new') return true
  if (EXERCISE_EDIT_PATH_PATTERN.test(pathname)) return true
  if (pathname === '/dev' || pathname.startsWith('/dev/')) return true
  return false
}

export async function assertDeveloperToolsAccess(
  supabase: SupabaseClient
): Promise<User> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (user && isDeveloperToolsUser(user.email)) {
    return user
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  const sessionUser = session?.user ?? null

  if (sessionError || !sessionUser || !isDeveloperToolsUser(sessionUser.email)) {
    throw new Error(
      `Unauthorized developer tools access (${userError?.message ?? 'no server user'})`
    )
  }

  return sessionUser
}
