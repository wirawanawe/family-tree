import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { initDatabase } from '@/lib/db'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Family Tree',
  description: 'Manage and visualize your family tree',
}

// Initialize database on server start
if (typeof window === 'undefined') {
  initDatabase().catch(console.error)
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
