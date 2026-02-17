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

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()
  const setUser = useAuthStore((state) => state.setUser)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
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

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setError('Check your email for the confirmation link.')
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
          <p className="mt-2 text-sm text-muted">Welcome back. Log in to continue training.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Log in</CardTitle>
            <CardDescription>Use your email and password to access your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5">
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

              <div className="flex flex-col gap-3">
                <Button 
                  onClick={handleLogin}
                  disabled={loading}
                  className="w-full justify-center"
                >
                  {loading ? <Loader2 className="animate-spin h-4 w-4" /> : 'Log in'}
                </Button>
                <Button 
                  onClick={handleSignUp}
                  disabled={loading}
                  variant="outline"
                  className="w-full justify-center"
                >
                  Create account
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
