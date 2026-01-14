'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Loader2, Dumbbell } from 'lucide-react'
import { Button } from '@/components/ui/Button' // Adjust based on your Button export (default vs named)
import { Card } from '@/components/ui/Card'     // Adjust based on your Card export
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
      router.push('/')
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
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
            <Dumbbell className="h-8 w-8 text-emerald-500" />
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-white">Ironplan</h2>
          <p className="mt-2 text-sm text-slate-400">Log in to your account</p>
        </div>

        <Card className="p-8 bg-slate-900 border-slate-800">
          <form className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300">
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-base"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-base"
                />
              </div>
            </div>

            {error && (
              <div className="text-red-400 text-sm text-center bg-red-900/20 p-2 rounded">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <Button 
                onClick={handleLogin}
                disabled={loading}
                className="w-full justify-center"
              >
                {loading ? <Loader2 className="animate-spin h-4 w-4" /> : 'Log In'}
              </Button>
              <Button 
                onClick={handleSignUp}
                disabled={loading}
                variant="outline"
                className="w-full justify-center"
              >
                Sign Up
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
