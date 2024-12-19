import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NBA Box Scores',
  description: 'Live NBA scores and box scores',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-100 min-h-screen">
        {children}
      </body>
    </html>
  )
}
