import { LayoutDashboard, LineChart, LucideIcon, UserRound } from 'lucide-react'

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
}

export const primaryNavItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard
  },
  {
    label: 'Progress',
    href: '/progress',
    icon: LineChart
  },
  {
    label: 'Profile',
    href: '/profile',
    icon: UserRound
  }
]

export const secondaryNavItems: NavItem[] = []
