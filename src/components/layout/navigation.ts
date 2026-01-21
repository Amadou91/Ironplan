import { Dumbbell, LayoutDashboard, LineChart, Settings, UserRound } from 'lucide-react'

export const primaryNavItems = [
  {
    label: 'Today',
    href: '/dashboard',
    icon: LayoutDashboard
  },
  {
    label: 'Workouts',
    href: '/workouts',
    icon: Dumbbell
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

export const secondaryNavItems = [
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings
  }
]
