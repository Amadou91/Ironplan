import type { AuthUser } from '../store/authStore'

export const getUserDisplayName = (user: AuthUser | null) => {
  if (!user?.email) return 'there'
  return user.email.split('@')[0] || user.email
}

export const getAuthNavState = (user: AuthUser | null) => {
  if (!user) {
    return {
      actionLabel: 'Log In',
      greeting: null
    }
  }

  return {
    actionLabel: 'Log Out',
    greeting: `Hi, ${getUserDisplayName(user)}`
  }
}
