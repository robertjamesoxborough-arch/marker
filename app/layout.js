import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import { BRAND_NAME } from '../lib/brand'
import ConsentGate from '../components/ConsentGate'
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
  title: `${BRAND_NAME}: recruitment you can actually trust`,
  description: 'Score every job before you apply. Free to start, transparent about what is built and what is not yet.',
  openGraph: {
    title: `${BRAND_NAME}: recruitment you can actually trust`,
    description: 'Score every job before you apply. Free to start, transparent about what is built and what is not yet.',
    siteName: BRAND_NAME,
    type: 'website',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: BRAND_NAME }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${BRAND_NAME}: recruitment you can actually trust`,
    description: 'Score every job before you apply. Free to start, transparent about what is built and what is not yet.',
    images: ['/opengraph-image'],
  },
}
export const viewport = { width: 'device-width', initialScale: 1, maximumScale: 1 }

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body>
        {children}
        {/* Everything non-essential (analytics, performance monitoring,
            referral attribution) is mounted by this gate and only after an
            explicit "accept". See components/ConsentGate.js. */}
        <ConsentGate />
      </body>
    </html>
  )
}
