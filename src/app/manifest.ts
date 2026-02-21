import type { MetadataRoute } from 'next'

/* display_override is not yet in Next.js Manifest type but is a valid W3C field */
type ManifestShortcut = {
  name: string
  short_name?: string
  description?: string
  url: string
  icons?: Array<{ src: string; sizes?: string; type?: string; purpose?: string }>
}

type Manifest = MetadataRoute.Manifest & {
  display_override?: string[]
  shortcuts?: ManifestShortcut[]
}

export default function manifest(): Manifest {
  return {
    name: 'Ironplan',
    short_name: 'Ironplan',
    description: 'AI-assisted workout planning and seamless session tracking',
    lang: 'en-US',
    dir: 'ltr',
    id: '/',
    start_url: '/dashboard?source=pwa',
    scope: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
    orientation: 'any',
    background_color: '#f8f6f2',
    theme_color: '#f8f6f2',
    prefer_related_applications: false,
    categories: ['health', 'fitness', 'lifestyle'],
    shortcuts: [
      {
        name: 'Start Session',
        short_name: 'Start',
        description: 'Jump directly into the workout setup flow',
        url: '/dashboard?quickStart=1',
        icons: [{ src: '/icon?size=192', sizes: '192x192', type: 'image/png' }]
      },
      {
        name: 'Progress',
        short_name: 'Progress',
        description: 'View progress and training insights',
        url: '/progress',
        icons: [{ src: '/icon?size=192', sizes: '192x192', type: 'image/png' }]
      },
      {
        name: 'Profile',
        short_name: 'Profile',
        description: 'Manage body metrics and equipment',
        url: '/profile',
        icons: [{ src: '/icon?size=192', sizes: '192x192', type: 'image/png' }]
      }
    ],
    icons: [
      {
        src: '/icon?size=192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icon?size=512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any'
      }
    ]
  }
}
