import { LayoutDashboard, LineChart, UserRound, LucideIcon } from 'lucide-react'

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
}

export const primaryNavItems: NavItem[] = [
  {
    label: 'Today',
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
