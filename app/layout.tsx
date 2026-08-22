import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Archivo, Inter, JetBrains_Mono } from 'next/font/google'
import { CheckoutOverlayProvider } from '@/components/checkout-overlay'
import { EmbeddedFlag } from '@/components/embedded-flag'
import { siteUrl } from '@/lib/site-url'
import './globals.css'

// As variáveis são lidas por `globals.css`, tanto pelos utilitários da
// landing quanto pelas classes semânticas do funil.
const archivo = Archivo({ subsets: ['latin'], variable: '--font-archivo', display: 'swap' })
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' })

const TITLE = 'Curso de Punção Venosa | Cruz Vermelha Brasileira do Rio de Janeiro'
const DESCRIPTION =
  'Curso presencial de Punção Venosa com 8 horas, conteúdo técnico aplicado à rotina e certificado da Cruz Vermelha Brasileira do Rio de Janeiro.'
const OG_DESCRIPTION =
  'Compreenda técnica, materiais, biossegurança e prevenção de complicações em uma formação presencial de 8 horas.'

const BASE = siteUrl()

export const metadata: Metadata = {
  // Sem base, a imagem de compartilhamento é resolvida contra localhost e o
  // link da landing sai sem preview no WhatsApp e nos anúncios.
  metadataBase: BASE ? new URL(BASE) : undefined,
  title: TITLE,
  description: DESCRIPTION,
  generator: 'v0.app',
  manifest: '/manifest.webmanifest',
  // As variantes A e B compartilham a mesma canonical: uma única página indexável.
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: '/',
    siteName: 'Escola de Educação e Saúde da Cruz Vermelha Brasileira do Rio de Janeiro',
    title: TITLE,
    description: OG_DESCRIPTION,
    images: [
      {
        url: '/logo-cvb-rj.png',
        width: 1200,
        height: 630,
        alt: 'Cruz Vermelha Brasileira do Rio de Janeiro',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: OG_DESCRIPTION,
  },
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
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
    <html lang="pt-BR" className={`${archivo.variable} ${inter.variable} ${mono.variable} bg-background`}>
      <body className="font-sans antialiased">
        <EmbeddedFlag />
        <CheckoutOverlayProvider>{children}</CheckoutOverlayProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
