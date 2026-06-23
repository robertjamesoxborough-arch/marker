import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import { Suspense } from 'react'
import { BRAND_NAME } from '../lib/brand'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import RefCapture from '../components/RefCapture'
import CookieBanner from '../components/CookieBanner'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export const metadata = {
  metadataBase: new URL('https://marker-silk.vercel.app'),
  title: BRAND_NAME,
  description: "For experienced people who'd quite like their evenings back. Score every role against what actually matters — salary, office days, parental leave, culture. Then go and live your life.",
  openGraph: {
    title: BRAND_NAME,
    description: "For experienced people who'd quite like their evenings back",
    siteName: BRAND_NAME,
    type: 'website',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: BRAND_NAME }],
  },
  twitter: {
    card: 'summary_large_image',
    title: BRAND_NAME,
    description: "For experienced people who'd quite like their evenings back",
    images: ['/opengraph-image'],
  },
}
export const viewport = { width: 'device-width', initialScale: 1, maximumScale: 1 }

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body>
        <Suspense fallback={null}><RefCapture /></Suspense>
        {children}
        <CookieBanner />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
