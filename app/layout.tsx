import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from './components/ThemeProvider'
import { ThemeToggle } from './components/ThemeToggle'
import { DynamicTablePopover } from './components/DynamicTablePopover'
import { LiveModeToggle } from '@/components/LiveModeToggle'
import { MotherDuckClientProvider } from '@/lib/MotherDuckContext'
import { LiveDataProvider } from '@/lib/LiveDataContext'
import SportTitle from '@/components/SportTitle'

export const metadata: Metadata = {
  title: 'Sports Box Scores',
  description: 'Live sports scores and box scores',
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
          <MotherDuckClientProvider>
            <LiveDataProvider>
              <header className="fixed top-0 left-0 right-0 bg-white dark:bg-gray-800 shadow-md z-50">
                <div className="container mx-auto px-2 md:px-4 py-3 md:py-4 flex justify-between items-center">
                  <SportTitle />
                  <div className="flex items-center">
                    <LiveModeToggle />
                    <DynamicTablePopover />
                    <ThemeToggle />
                  </div>
                </div>
              </header>
              <main className="pt-16 text-gray-900 dark:text-gray-100">
                {children}
              </main>
            </LiveDataProvider>
          </MotherDuckClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
