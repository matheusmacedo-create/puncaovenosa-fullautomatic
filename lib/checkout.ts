import { normalizeVariant, VARIANT_COOKIE, type Variant } from '@/lib/ab-test'

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

/** landing_view — carregamento da landing. */
export function trackLandingView(variant: Variant) {
  if (typeof window === 'undefined') return
  push({ event: 'landing_view', variant, ...currentUtms() })
}

/** cta_click — clique em qualquer CTA de matrícula. */
export function trackCtaClick(position: CtaPosition) {
  if (typeof window === 'undefined') return
  push({ event: 'cta_click', cta_position: position, variant: currentVariant(), ...currentUtms() })
}

export type FooterContactTarget = 'whatsapp' | 'email' | 'instagram' | 'facebook' | 'maps'

/** footer_contact_click — clique em contato no rodapé ou na seção de localização. */
export function trackFooterContactClick(destination: FooterContactTarget) {
  if (typeof window === 'undefined') return
  push({ event: 'footer_contact_click', destination, variant: currentVariant() })
}

type InitiateCheckoutPayload = {
  position: CtaPosition
  value: number
  totalValue: number
  courseName: string
  metaPixelId: string | null
}

/**
 * initiate_checkout — entrada no checkout.
 * A conversão principal (matricula_paid) é registrada pelo checkout após o
 * pagamento confirmado, com variant, valor e transaction_id.
 */
export function trackInitiateCheckout({
  position,
  value,
  totalValue,
  courseName,
  metaPixelId,
}: InitiateCheckoutPayload) {
  if (typeof window === 'undefined') return

  const variant = currentVariant()
  push({
    event: 'initiate_checkout',
    cta_position: position,
    value,
    total_value: totalValue,
    currency: 'BRL',
    course_name: courseName,
    variant,
    ...currentUtms(),
  })

  const w = window as typeof window & { fbq?: (...args: unknown[]) => void }
  if (metaPixelId && typeof w.fbq === 'function') {
    w.fbq('track', 'InitiateCheckout', {
      value,
      currency: 'BRL',
      content_name: courseName,
      cta_position: position,
      variant,
    })
  }
}
