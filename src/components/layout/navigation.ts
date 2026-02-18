import { LayoutDashboard, LineChart, LucideIcon } from 'lucide-react'

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
  }
]

export const secondaryNavItems: NavItem[] = []
