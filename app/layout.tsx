import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Archivo, Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const archivo = Archivo({ subsets: ['latin'], variable: '--font-archivo', display: 'swap' })
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' })

export const metadata: Metadata = {
  title: 'Curso de Punção Venosa · Cruz Vermelha Brasileira RJ',
  description:
    'Garanta sua vaga no curso presencial de Punção Venosa (8h) na sede da Cruz Vermelha Brasileira no Rio de Janeiro. Inscrição via PIX.',
  generator: 'v0.app',
  manifest: '/manifest.webmanifest',
}

export const viewport: Viewport = {
  themeColor: '#C8102E',
  userScalable: true,
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={`${archivo.variable} ${inter.variable} ${mono.variable}`}>
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
