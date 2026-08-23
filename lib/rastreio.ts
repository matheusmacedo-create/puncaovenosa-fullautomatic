'use client'

import { courseData } from '@/lib/course-data'
import { PIXEL_ID } from '@/lib/pixel-id'

export { PIXEL_ID }

/**
 * Rastreamento do funil, ponta a ponta.
 *
 * Cada etapa tem nome próprio e um evento do Meta correspondente. Os nomes
 * ficam todos aqui, e não espalhados pelas telas, porque relatório de anúncio
 * se lê pelo nome do evento: um `Lead` disparado de dois lugares com nomes
 * diferentes vira duas linhas que ninguém consegue comparar.
 *
 * Sem `NEXT_PUBLIC_META_PIXEL_ID`, tudo aqui vira função vazia — nenhum pixel
 * fictício é instalado, e o funil funciona igual.
 */

type EventoPadrao =
  | 'ViewContent' | 'InitiateCheckout' | 'Lead'
  | 'AddPaymentInfo' | 'Purchase' | 'CompleteRegistration'

type Etapa = {
  /** Nome da etapa, usado no dataLayer e como evento próprio no Meta. */
  nome: string
  /** Evento padrão do Meta, quando existe um que signifique a mesma coisa. */
  evento: EventoPadrao | null
  /** Só as etapas de dinheiro carregam valor. */
  comValor?: boolean
}

/**
 * As oito partes do funil, na ordem em que o aluno passa por elas.
 *
 * A numeração no nome não é enfeite: no gerenciador do Meta os eventos
 * aparecem em ordem alfabética, e sem ela `funil_pago` viria antes de
 * `funil_dados` — o funil apareceria de cabeça para baixo.
 */
export const ETAPAS = {
  landing:       { nome: 'funil_1_landing',       evento: 'ViewContent' },
  cta:           { nome: 'funil_2_cta',           evento: 'InitiateCheckout' },
  dados:         { nome: 'funil_3_dados',         evento: 'Lead' },
  pagamento:     { nome: 'funil_4_pagamento',     evento: 'AddPaymentInfo', comValor: true },
  pago:          { nome: 'funil_5_pago',          evento: 'Purchase', comValor: true },
  triagemInicio: { nome: 'funil_6_triagem_inicio', evento: null },
  triagemFim:    { nome: 'funil_7_triagem_fim',   evento: 'CompleteRegistration' },
  ficha:         { nome: 'funil_8_ficha',         evento: null },
} as const satisfies Record<string, Etapa>

export type NomeDaEtapa = keyof typeof ETAPAS

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
