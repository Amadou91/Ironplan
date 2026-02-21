import type { Metadata, Viewport } from 'next'
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { RouteErrorBoundary } from "@/components/ui/ErrorBoundary";
import { AppShell } from "@/components/layout/AppShell";
import { PwaEnhancements } from '@/components/ui/PwaEnhancements'
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ironplan.app'),
  title: 'Ironplan',
  description: 'AI-assisted workout planning and seamless session tracking',
  applicationName: 'Ironplan',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Ironplan'
  },
  formatDetection: {
    telephone: false
  },
  other: {
    'mobile-web-app-capable': 'yes'
  }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f6f2' },
    { media: '(prefers-color-scheme: dark)', color: '#1f2735' }
  ]
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* iPad-specific apple-touch-icon sizes (iPad = 152, iPad Pro = 167) */}
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-icon" />
        <link rel="apple-touch-icon" sizes="167x167" href="/apple-icon" />
        <link rel="apple-touch-icon" sizes="152x152" href="/apple-icon" />
        {process.env.NODE_ENV === 'production' && (
          <script
            dangerouslySetInnerHTML={{ __html:
              `if('serviceWorker'in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(function(){})})}`
            }}
          />
        )}
      </head>
      <body
        className="antialiased"
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <ToastProvider>
              <RouteErrorBoundary>
                <AppShell>{children}</AppShell>
                <PwaEnhancements />
              </RouteErrorBoundary>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
