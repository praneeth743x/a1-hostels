import type { Metadata } from 'next'
import NextTopLoader from 'nextjs-toploader'
import './globals.css'

export const metadata: Metadata = {
  title: 'StaySync | Smart PG Management',
  description: 'High-end multi-tenant SaaS for PG hostel management.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <NextTopLoader 
          color="#3F51B5"
          initialPosition={0.08}
          crawlSpeed={200}
          height={3}
          crawl={true}
          showSpinner={false}
          easing="ease"
          speed={200}
          shadow="0 0 10px #3F51B5,0 0 5px #3F51B5"
        />
        {children}
      </body>
    </html>
  )
}
