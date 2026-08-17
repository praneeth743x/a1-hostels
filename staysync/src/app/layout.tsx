import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import './globals.css'
import { HostelProvider } from '@/context/HostelContext'
import { Toaster } from 'react-hot-toast'
import { ConfirmProvider } from '@/context/ConfirmContext'

export const viewport: Viewport = {
  themeColor: '#4F46E5',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'A1 Hostels | Premium Pg Hostels',
  description: 'Premium PG hostel living experience with modern amenities and 24/7 digital support.',
  manifest: '/manifest.json',
  icons: {
    icon: '/himalaya_logo_premium.png',
    shortcut: '/himalaya_logo_premium.png',
    apple: '/himalaya_logo_premium.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'A1 Hostels',
  },
  formatDetection: {
    telephone: false,
  },
}

import { FaviconUpdater } from '@/components/FaviconUpdater';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning data-build="2026-08-14-CLEAN_DEPLOY">
        <FaviconUpdater />
        <ConfirmProvider>
          <HostelProvider>
            {children}
            <Toaster position="bottom-right" />
          </HostelProvider>
        </ConfirmProvider>
        <Script
          id="sw-register"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') {
                console.log('Build: 2026-08-14-CLEAN_DEPLOY');
              }
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                    navigator.serviceWorker.getRegistrations().then(function(registrations) {
                      for (let reg of registrations) {
                        reg.unregister();
                      }
                    });
                  } else {
                    navigator.serviceWorker.register('/sw.js').then(function(registration) {
                      registration.update();
                      if (window.__startupTracer) window.__startupTracer.mark('S9_swRegistered');
                    }).catch(function(err) {});
                  }
                });
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
