import { useAuthStore } from '@/store/authStore'

export function useUser() {
  const user = useAuthStore((state) => state.user)
  const hydrated = useAuthStore((state) => state.hydrated)
  const loading = !hydrated
  return { user, loading }
}
