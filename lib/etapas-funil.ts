/**
 * As oito etapas do funil — nomes e evento padrão do Meta correspondente.
 *
 * Vive num arquivo à parte, sem `'use client'`, pelo mesmo motivo de
 * `lib/pixel-id.ts`: o navegador (`lib/rastreio.ts`) e o servidor
 * (`lib/meta-capi.ts`) precisam do mesmo nome de etapa para o `event_id` do
 * pixel e o da Conversions API baterem e o Meta deduplicar os dois como um
 * evento só. Duas cópias do mesmo nome, uma no cliente e outra no servidor,
 * é como o `PIXEL_ID` chegou a divergir — não repita isso aqui.
 */

export type EventoPadrao =
  | 'ViewContent' | 'InitiateCheckout' | 'Lead'
  | 'AddPaymentInfo' | 'Purchase' | 'CompleteRegistration'

export type Etapa = {
  /** Nome da etapa, usado no dataLayer e como evento próprio no Meta. */
  nome: string
  /** Evento padrão do Meta, quando existe um que signifique a mesma coisa. */
  evento: EventoPadrao | null
  /** Só as etapas de dinheiro carregam valor. */
  comValor?: boolean
}

/**
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

/** Do nome exibido ('funil_5_pago') de volta para a chave ('pago') — usado no reenvio manual da Conversions API em /secretaria. */
export const NOME_PARA_ETAPA: Record<string, NomeDaEtapa> = Object.fromEntries(
  (Object.entries(ETAPAS) as [NomeDaEtapa, Etapa][]).map(([chave, { nome }]) => [nome, chave]),
)
