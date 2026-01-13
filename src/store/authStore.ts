import { createStore } from 'zustand/vanilla'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { useStore } from 'zustand'
import type { User } from '@supabase/supabase-js'

export type AuthUser = {
  id: string
  email: string | null
}

export type AuthState = {
  user: AuthUser | null
  hydrated: boolean
  setUser: (user: AuthUser | null) => void
  clearUser: () => void
  setHydrated: (hydrated: boolean) => void
}

export const toAuthUser = (user: User | null): AuthUser | null => {
  if (!user) return null

  return {
    id: user.id,
    email: user.email ?? null
  }
}

export const createAuthStore = (storage?: StateStorage) =>
  createStore<AuthState>()(
    persist(
      (set) => ({
        user: null,
        hydrated: false,
        setUser: (user) => set({ user }),
        clearUser: () => set({ user: null }),
        setHydrated: (hydrated) => set({ hydrated })
      }),
      {
        name: 'auth-store',
        storage: storage ? createJSONStorage(() => storage) : undefined,
        partialize: (state) => ({ user: state.user })
      }
    )
  )

export const authStore = createAuthStore(
  typeof window !== 'undefined' ? window.localStorage : undefined
)

export const useAuthStore = <T,>(selector: (state: AuthState) => T) =>
  useStore(authStore, selector)
