import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from './components/ThemeProvider'
import { ThemeToggle } from './components/ThemeToggle'

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
    <html lang="en" suppressHydrationWarning>
      <body className="bg-white dark:bg-gray-900 min-h-screen">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <header className="fixed top-0 left-0 right-0 bg-white dark:bg-gray-800 shadow-md z-50">
            <div className="container mx-auto px-4 py-4 flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">NBA Box Scores</h1>
              <ThemeToggle />
            </div>
          </header>
          <main className="pt-16 text-gray-900 dark:text-gray-100">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  )
}
