'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Loader2, Dumbbell } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Alert } from '@/components/ui/Alert'
import { toAuthUser, useAuthStore } from '@/store/authStore'

const MIN_PASSWORD_LENGTH = 6

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const router = useRouter()
  const setUser = useAuthStore((state) => state.setUser)

  const switchMode = (next: 'login' | 'signup') => {
    setMode(next)
    setError(null)
    setSuccess(null)
    setPassword('')
    setConfirmPassword('')
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    let data: Awaited<ReturnType<ReturnType<typeof createClient>['auth']['signInWithPassword']>>['data'] | null = null
    let signInError: Awaited<ReturnType<ReturnType<typeof createClient>['auth']['signInWithPassword']>>['error'] | null = null

    try {
      const supabase = createClient()
      const result = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      data = result.data
      signInError = result.error
    } catch {
      setError('Authentication is not configured. Please check Supabase environment variables.')
      setLoading(false)
      return
    }

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
    } else {
      setUser(toAuthUser(data.session?.user ?? null))
      router.push('/dashboard')
      router.refresh()
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }

    let signUpError: Awaited<ReturnType<ReturnType<typeof createClient>['auth']['signUp']>>['error'] | null = null

    try {
      const supabase = createClient()
      const result = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${location.origin}/auth/callback`,
        },
      })
      signUpError = result.error
    } catch {
      setError('Authentication is not configured. Please check Supabase environment variables.')
      setLoading(false)
      return
    }

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
    } else {
      setSuccess('Account created! Check your email for the confirmation link.')
      setLoading(false)
    }
  }

  return (
    <div className="page-shell flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-primary-border)] bg-[var(--color-primary-soft)] shadow-[var(--shadow-sm)]">
            <Dumbbell className="h-8 w-8 text-accent" />
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-strong">Ironplan</h1>
          <p className="mt-2 text-sm text-muted">
            {mode === 'login'
              ? 'Welcome back. Log in to continue training.'
              : 'Create an account to start training.'}
          </p>
        </div>

        {mode === 'login' ? (
          <Card>
            <CardHeader>
              <CardTitle>Log in</CardTitle>
              <CardDescription>Use your email and password to access your account.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                {error ? <Alert variant="error">{error}</Alert> : null}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full justify-center"
                >
                  {loading ? <Loader2 className="animate-spin h-4 w-4" /> : 'Log in'}
                </Button>

                <p className="text-center text-sm text-muted">
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('signup')}
                    className="font-medium text-accent hover:underline"
                  >
                    Create account
                  </button>
                </p>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Create account</CardTitle>
              <CardDescription>Enter your details to get started.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSignUp} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="signup-email">Email address</Label>
                  <Input
                    id="signup-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <p className="text-xs text-muted">At least {MIN_PASSWORD_LENGTH} characters</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="signup-confirm">Confirm password</Label>
                  <Input
                    id="signup-confirm"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>

                {error ? <Alert variant="error">{error}</Alert> : null}
                {success ? <Alert variant="success">{success}</Alert> : null}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full justify-center"
                >
                  {loading ? <Loader2 className="animate-spin h-4 w-4" /> : 'Create account'}
                </Button>

                <p className="text-center text-sm text-muted">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="font-medium text-accent hover:underline"
                  >
                    Log in
                  </button>
                </p>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
