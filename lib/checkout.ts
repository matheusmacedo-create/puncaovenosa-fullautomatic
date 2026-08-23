import { normalizeVariant, VARIANT_COOKIE, type Variant } from '@/lib/ab-test'
import { rastrear } from '@/lib/rastreio'

export type CtaPosition = 'hero' | 'content' | 'offer' | 'sticky' | 'final'

const TRACKED_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'utm_id',
  'fbclid',
  'ttclid',
  'gclid',
]

/** Variante ativa do visitante, usada em todos os eventos. */
export function currentVariant(): Variant {
  if (typeof window === 'undefined') return 'a'
  const fromUrl = normalizeVariant(new URLSearchParams(window.location.search).get('variant'))
  if (fromUrl) return fromUrl
  const match = document.cookie.match(new RegExp(`(?:^|; )${VARIANT_COOKIE}=([^;]*)`))
  return normalizeVariant(match?.[1] ?? null) ?? 'a'
}

/** UTMs presentes na URL atual, repassadas aos eventos e ao checkout. */
export function currentUtms(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const params = new URLSearchParams(window.location.search)
  const utms: Record<string, string> = {}
  for (const key of TRACKED_PARAMS) {
    const value = params.get(key)
    if (value) utms[key] = value
  }
  return utms
}

/** Eventos que não são etapa do funil continuam só no dataLayer. */
function push(detail: Record<string, unknown>) {
  const w = window as typeof window & { dataLayer?: unknown[] }
  w.dataLayer = w.dataLayer || []
  w.dataLayer.push(detail)
  window.dispatchEvent(new CustomEvent(String(detail.event), { detail }))
}

/** Preserva UTMs e a variante ao enviar o usuário para o checkout. */
export function buildCheckoutUrl(checkoutUrl: string, position: CtaPosition) {
  if (typeof window === 'undefined') return checkoutUrl
  if (!checkoutUrl || checkoutUrl === '#') return checkoutUrl

  try {
    const target = new URL(checkoutUrl, window.location.origin)
    for (const [key, value] of Object.entries(currentUtms())) {
      target.searchParams.set(key, value)
    }
    target.searchParams.set('variant', currentVariant())
    target.searchParams.set('cta_position', position)
    // Pula a tela de demonstração do checkout e abre direto o painel lateral
    // de inscrição (etapa 1/9), onde o visitante já preenche os dados.
    target.searchParams.set('etapa', 'dados')
    return target.toString()
  } catch {
    return checkoutUrl
  }
}

/** Etapa 1 do funil: a landing foi vista. */
export function trackLandingView(variant: Variant) {
  if (typeof window === 'undefined') return
  rastrear('landing', { dados: { variant, ...currentUtms() }, umaVezSo: true })
}

/**
 * Etapa 2: clique num CTA de matrícula.
 *
 * Era um par de eventos (`cta_click` e `initiate_checkout`) disparados sempre
 * juntos, do mesmo clique. Virou um só: dois nomes para o mesmo gesto rendiam
 * dois números iguais no relatório e a dúvida de qual olhar.
 */
export function trackCtaClick(position: CtaPosition) {
  if (typeof window === 'undefined') return
  rastrear('cta', { dados: { cta_position: position, variant: currentVariant(), ...currentUtms() } })
}

export type FooterContactTarget = 'whatsapp' | 'email' | 'instagram' | 'facebook' | 'maps'

/** Contato no rodapé: não é etapa do funil, é saída para outro canal. */
export function trackFooterContactClick(destination: FooterContactTarget) {
  if (typeof window === 'undefined') return
  push({ event: 'footer_contact_click', destination, variant: currentVariant() })
}
