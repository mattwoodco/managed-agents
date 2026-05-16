import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

const ogImage = '/gauntlet-logo.png'

export const metadata: Metadata = {
  metadataBase: new URL('https://managed-agents.mattwood.co'),
  title: 'From Chatbots to Digital Workers',
  description:
    'Building Autonomous Infrastructure with Computer Science Principles — a deck on moving from chat to work.',
  icons: { icon: '/favicon.png' },
  openGraph: {
    title: 'From Chatbots to Digital Workers',
    description: 'Building Autonomous Infrastructure with Computer Science Principles.',
    images: [{ url: ogImage }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'From Chatbots to Digital Workers',
    description: 'Building Autonomous Infrastructure with Computer Science Principles.',
    images: [ogImage],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#111111',
}

type Props = { children: ReactNode }

export default function RootLayout({ children }: Props) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
