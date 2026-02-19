import type { Metadata, Viewport } from 'next'
import { JetBrains_Mono, Source_Sans_3, Space_Grotesk } from "next/font/google";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { RouteErrorBoundary } from "@/components/ui/ErrorBoundary";
import { AppShell } from "@/components/layout/AppShell";
import { PwaEnhancements } from '@/components/ui/PwaEnhancements'
import "./globals.css";

const displayFont = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const bodyFont = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const monoFont = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://ironplan.app'),
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
  maximumScale: 1,
  userScalable: false,
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
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Ironplan" />
      </head>
      <body
        className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable} antialiased`}
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
