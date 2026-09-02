import { registrarVisita } from '@/lib/api-cliente'
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

export type Atribuicao = {
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
}

/**
 * De onde veio este visitante, no formato que `visitas_landing` e
 * `inscricoes` gravam. Fonte única das duas pontas: é o que permite cruzar
 * "quantos viram" com "quantos pagaram" pela mesma campanha.
 *
 * Já houve aqui um campo `variante`, de quando havia duas páginas de venda.
 * As colunas continuam no banco, com o histórico do que foi medido, mas não
 * recebem valor novo: com uma página só, a campanha é a única origem que
 * ainda distingue alguma coisa.
 */
export function atribuicaoAtual(): Atribuicao {
  if (typeof window === 'undefined') return {}
  const utms = currentUtms()
  return {
    utmSource: utms.utm_source,
    utmMedium: utms.utm_medium,
    utmCampaign: utms.utm_campaign,
  }
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

/** Preserva as UTMs ao enviar o usuário para o checkout. */
export function buildCheckoutUrl(checkoutUrl: string, position: CtaPosition) {
  if (typeof window === 'undefined') return checkoutUrl
  if (!checkoutUrl || checkoutUrl === '#') return checkoutUrl

  try {
    const target = new URL(checkoutUrl, window.location.origin)
    for (const [key, value] of Object.entries(currentUtms())) {
      target.searchParams.set(key, value)
    }
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
export function trackLandingView() {
  if (typeof window === 'undefined') return
  rastrear('landing', { dados: { ...currentUtms() }, umaVezSo: true })
  // Espelha no nosso banco: é o único jeito de "quantas visitas viraram
  // inscrição" aparecer em /secretaria — o pixel do Meta conta PageView do
  // lado dele, mas essa contagem não existe em lugar nenhum nosso sem isto.
  registrarVisita(atribuicaoAtual()).catch(() => undefined)
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
  rastrear('cta', { dados: { cta_position: position, ...currentUtms() } })
}

export type FooterContactTarget = 'whatsapp' | 'email' | 'instagram' | 'facebook' | 'maps'

/** Contato no rodapé: não é etapa do funil, é saída para outro canal. */
export function trackFooterContactClick(destination: FooterContactTarget) {
  if (typeof window === 'undefined') return
  push({ event: 'footer_contact_click', destination })
}
