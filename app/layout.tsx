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
        <header className="fixed top-0 left-0 right-0 bg-white shadow-md z-50">
          <div className="container mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold text-center">NBA Box Scores</h1>
          </div>
        </header>
        <main className="pt-16">
          {children}
        </main>
      </body>
    </html>
  )
}
