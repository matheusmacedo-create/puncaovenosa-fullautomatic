/**
 * De onde veio quem está no funil, lido da URL. Módulo sem dependências de
 * propósito: `lib/checkout.ts` (eventos e visita) e `lib/api-cliente.ts`
 * (cobrança) usam a mesma lista e o mesmo formato, sem importar um ao outro.
 */

/** Parâmetros de origem que acompanham a pessoa do anúncio até o pagamento. */
export const PARAMETROS_DE_ORIGEM = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'utm_id',
  'fbclid',
  'ttclid',
  'gclid',
] as const

/** Os parâmetros de origem presentes na URL atual. */
export function origemDaUrl(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const params = new URLSearchParams(window.location.search)
  const r: Record<string, string> = {}
  for (const chave of PARAMETROS_DE_ORIGEM) {
    const valor = params.get(chave)
    if (valor) r[chave] = valor
  }
  return r
}

/**
 * As UTMs que vão com a cobrança para a Únicopag. É o que permite ao
 * sistema administrativo da escola (a Redação) somar a receita por campanha
 * (utm_campaign) e por página de anúncio (utm_content — cada advertorial tem
 * o seu).
 */
export type UtmsDaCobranca = { utmSource?: string; utmMedium?: string; utmCampaign?: string; utmContent?: string; utmTerm?: string }

export function utmsDaCobranca(): UtmsDaCobranca {
  const o = origemDaUrl()
  return { utmSource: o.utm_source, utmMedium: o.utm_medium, utmCampaign: o.utm_campaign, utmContent: o.utm_content, utmTerm: o.utm_term }
}
