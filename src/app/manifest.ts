import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ironplan',
    short_name: 'Ironplan',
    description: 'AI-assisted workout planning and seamless session tracking',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f8f6f2',
    theme_color: '#f8f6f2',
    categories: ['health', 'fitness', 'lifestyle'],
    icons: [
      {
        src: '/icon?size=192',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: '/icon?size=512',
        sizes: '512x512',
        type: 'image/png'
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png'
      }
    ]
  }
}
