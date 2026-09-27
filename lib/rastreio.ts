'use client'

import { courseData } from '@/lib/course-data'
import { type Etapa, ETAPAS, type NomeDaEtapa } from '@/lib/etapas-funil'
import { enviarAoPixel, jaNaFilaDoPixel } from '@/lib/pixel'
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
 * Nada daqui chega ao Meta sem consentimento de marketing: os eventos passam
 * por `enviarAoPixel` (`lib/pixel.ts`), que os segura em memória enquanto a
 * pessoa não escolheu e os descarta se ela disse "não".
 *
 * Sem `NEXT_PUBLIC_META_PIXEL_ID`, tudo aqui vira função vazia — nenhum pixel
 * fictício é instalado, e o funil funciona igual.
 */

/**
 * O dataLayer continua recebendo tudo, para quem preferir ler por lá. Fica só
 * na memória da página — nenhuma ferramenta o lê hoje. Quem ligar uma (Google
 * Tag Manager, por exemplo) precisa condicioná-la ao consentimento, como o
 * Pixel.
 */
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
 *
 * Só lê. A marca em `sessionStorage` é gravada por `lib/pixel.ts` no momento
 * em que o evento de fato vai ao Meta — sem permissão de marketing, nada é
 * gravado no navegador por causa do Pixel, e um evento que ficou na fila sem
 * ir não conta como enviado.
 */
function jaDisparou(chave: string) {
  if (jaNaFilaDoPixel(chave)) return true
  try {
    return Boolean(sessionStorage.getItem(chave))
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
  const chave = umaVezSo ? `cvb-rastreio:${nome}:${id ?? ''}` : undefined
  if (chave && jaDisparou(chave)) return

  if (comValor && valorCentavos === undefined) {
    console.error(`[rastreio] etapa "${nome}" precisa de valorCentavos e não recebeu — evento enviado sem valor.`)
  }
  const valor = comValor && valorCentavos !== undefined ? { value: valorCentavos / 100, currency: 'BRL' } : {}
  const corpo = { etapa: nome, content_name: courseData.courseName, ...valor, ...dados }

  paraODataLayer({ event: nome, ...corpo })

  if (!PIXEL_ID) return
  const opcoesDoMeta = id ? { eventID: `${nome}:${id}` } : undefined
  // O evento com nome próprio sempre vai: é ele que desenha o funil no
  // gerenciador. O evento padrão vai junto quando existe um equivalente,
  // porque é dele que as campanhas de conversão sabem otimizar.
  const chamadas: unknown[][] = [['trackCustom', nome, corpo, opcoesDoMeta]]
  if (evento) chamadas.push(['track', evento, corpo, opcoesDoMeta])
  enviarAoPixel(chamadas, chave)
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
  const chave = `cvb-engajamento:${nome}`
  if (jaDisparou(chave)) return

  const corpo = { evento: nome, content_name: courseData.courseName, ...dados }
  paraODataLayer({ event: nome, ...corpo })

  if (!PIXEL_ID) return
  enviarAoPixel([['trackCustom', nome, corpo]], chave)
}
