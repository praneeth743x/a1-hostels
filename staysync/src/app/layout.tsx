import type { Metadata } from 'next'
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
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
