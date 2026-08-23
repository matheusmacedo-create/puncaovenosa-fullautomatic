'use client'

import { courseData } from '@/lib/course-data'
import { type Etapa, ETAPAS, type NomeDaEtapa } from '@/lib/etapas-funil'
import { PIXEL_ID } from '@/lib/pixel-id'

export { PIXEL_ID, ETAPAS }
export type { NomeDaEtapa }

/**
 * Rastreamento do funil, ponta a ponta, do lado do navegador.
 *
 * As etapas (nomes, evento padrão do Meta) moraram aqui até o servidor
 * também precisar delas para a Conversions API — ver `lib/etapas-funil.ts`
 * para onde foram, e o motivo.
 *
 * Sem `NEXT_PUBLIC_META_PIXEL_ID`, tudo aqui vira função vazia — nenhum pixel
 * fictício é instalado, e o funil funciona igual.
 */

type Fbq = (...args: unknown[]) => void

const fbq = (): Fbq | null => {
  if (typeof window === 'undefined') return null
  const w = window as typeof window & { fbq?: Fbq }
  return typeof w.fbq === 'function' ? w.fbq : null
}

/** O dataLayer continua recebendo tudo, para quem preferir ler por lá. */
function paraODataLayer(detalhe: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  const w = window as typeof window & { dataLayer?: unknown[] }
  w.dataLayer = w.dataLayer || []
  w.dataLayer.push(detalhe)
  window.dispatchEvent(new CustomEvent(String(detalhe.event), { detail: detalhe }))
}

/**
 * Evita repetir o mesmo evento na mesma sessão.
 *
 * A tela de pagamento consulta o servidor em intervalos e pode voltar para a
 * confirmação várias vezes; sem isto, uma venda de R$ 249 viraria três no
 * relatório, e o custo por aquisição apareceria um terço do real.
 */
function jaDisparou(chave: string) {
  try {
    if (sessionStorage.getItem(chave)) return true
    sessionStorage.setItem(chave, '1')
    return false
  } catch {
    // Navegador com armazenamento bloqueado: melhor arriscar repetir do que
    // perder o evento.
    return false
  }
}

type Opcoes = {
  /** Dados extras do evento (posição do CTA, método de pagamento, etc.). */
  dados?: Record<string, unknown>
  /**
   * Identificador do que aconteceu — a cobrança, a inscrição. Vira `eventID`
   * no Meta, que descarta a repetição mesmo se ela vier de outro dispositivo
   * ou de uma segunda aba.
   */
  id?: string
  /** Dispara no máximo uma vez por sessão. */
  umaVezSo?: boolean
  /**
   * O que a cobrança de fato tem gravado, em centavos — nunca o preço atual.
   *
   * `PRECO_CENTAVOS` é uma constante do build; a cobrança é uma linha do
   * banco. As duas costumam bater, mas não é garantido: preço de teste
   * ligado ou desligado no meio de uma sessão com cobrança já aberta, ou um
   * desconto futuro, fariam o evento reportar um valor que não foi o
   * cobrado. Etapas com dinheiro exigem este campo — sem ele, o evento não
   * carrega valor nenhum, o que é mais seguro que carregar um errado.
   */
  valorCentavos?: number
}

export function rastrear(etapa: NomeDaEtapa, { dados = {}, id, umaVezSo, valorCentavos }: Opcoes = {}) {
  const { nome, evento, comValor } = ETAPAS[etapa] as Etapa
  if (umaVezSo && jaDisparou(`cvb-rastreio:${nome}:${id ?? ''}`)) return

  if (comValor && valorCentavos === undefined) {
    console.error(`[rastreio] etapa "${nome}" precisa de valorCentavos e não recebeu — evento enviado sem valor.`)
  }
  const valor = comValor && valorCentavos !== undefined ? { value: valorCentavos / 100, currency: 'BRL' } : {}
  const corpo = { etapa: nome, content_name: courseData.courseName, ...valor, ...dados }

  paraODataLayer({ event: nome, ...corpo })

  const enviar = fbq()
  if (!enviar || !PIXEL_ID) return

  const opcoesDoMeta = id ? { eventID: `${nome}:${id}` } : undefined
  // O evento com nome próprio sempre vai: é ele que desenha o funil no
  // gerenciador. O evento padrão vai junto quando existe um equivalente,
  // porque é dele que as campanhas de conversão sabem otimizar.
  enviar('trackCustom', nome, corpo, opcoesDoMeta)
  if (evento) enviar('track', evento, corpo, opcoesDoMeta)
}

/**
 * Sinais de engajamento da landing — rolagem, tempo na página — que não são
 * etapa do funil: não têm número, não desenham o funil de conversão em
 * `ETAPAS`, servem só para o Meta aprender quem é visitante engajado (útil
 * para otimização de campanha e para montar público de remarketing). Sempre
 * dispara no máximo uma vez por sessão — rolar a página pra cima e pra baixo
 * de novo não deveria contar como um segundo evento.
 */
export function rastrearEngajamento(nome: string, dados: Record<string, unknown> = {}) {
  if (jaDisparou(`cvb-engajamento:${nome}`)) return

  const corpo = { evento: nome, content_name: courseData.courseName, ...dados }
  paraODataLayer({ event: nome, ...corpo })

  const enviar = fbq()
  if (!enviar || !PIXEL_ID) return
  enviar('trackCustom', nome, corpo)
}
