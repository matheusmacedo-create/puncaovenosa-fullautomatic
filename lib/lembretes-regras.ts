/**
 * Quem recebe qual lembrete de recuperação — regra pura, sem banco nem
 * rede, para ser conferida por `scripts/conferir-lembretes.ts`. A varredura
 * que lê o banco e envia mora em `lib/lembretes.ts`.
 *
 * Três lembretes, cada um no máximo uma vez por inscrição:
 *
 * - `lembrete_pagamento_1`: abriu a cobrança da matrícula e não pagou. Sai
 *   na primeira varredura depois de `HORAS_ATE_PRIMEIRO` da primeira
 *   cobrança — antes disso, quem está pagando agora receberia um "você
 *   esqueceu" no meio do pagamento.
 * - `lembrete_pagamento_2`: o último, `DIAS_ENTRE_LEMBRETES` depois do
 *   primeiro. Depois dele, silêncio: insistência vira spam, e spam derruba a
 *   reputação do domínio que também entrega os comprovantes.
 * - `lembrete_triagem`: pagou a matrícula e não respondeu as 8 perguntas.
 *   Sem elas a secretaria não monta a turma.
 *
 * Nada sai para quem pediu para parar, para inscrição cancelada, nem para
 * quem começou há mais de `DIAS_MAXIMOS_PAGAMENTO` — no primeiro deploy, a
 * varredura não pode acordar leads de meses atrás.
 */

export const TIPOS_DE_LEMBRETE = ['lembrete_pagamento_1', 'lembrete_pagamento_2', 'lembrete_triagem'] as const
export type TipoDeLembrete = (typeof TIPOS_DE_LEMBRETE)[number]

export const HORAS_ATE_PRIMEIRO = 3
export const DIAS_ENTRE_LEMBRETES = 3
export const DIAS_MAXIMOS_PAGAMENTO = 10
export const HORAS_ATE_LEMBRETE_TRIAGEM = 20
export const DIAS_MAXIMOS_TRIAGEM = 14

/**
 * O horário exato de cada rodada varia alguns minutos (o agendamento do
 * GitHub atrasa em horário de pico). Sem folga, um lembrete marcado para "3
 * dias depois" pularia para a rodada seguinte sempre que a de hoje rodasse
 * um pouco mais cedo que a de 3 dias atrás.
 */
const FOLGA_MS = 2 * 60 * 60 * 1000

/**
 * Janela do dia em que lembrete pode sair, no horário de Brasília (UTC−3, sem
 * horário de verão desde 2019). As rodadas agendadas já caem dentro dela; a
 * conferência existe para uma chamada manual ou um agendamento atrasado não
 * mandar e-mail de madrugada.
 */
export const HORA_PRIMEIRA_RODADA = 7
export const HORA_ULTIMA_RODADA = 22

export function dentroDoHorario(agora: number) {
  const hora = new Date(agora - 3 * 60 * 60 * 1000).getUTCHours()
  return hora >= HORA_PRIMEIRA_RODADA && hora <= HORA_ULTIMA_RODADA
}

const HORA = 60 * 60 * 1000
const DIA = 24 * HORA

export type Candidato = {
  status: string
  email: string | null
  lembretesDesligados: boolean
  /** Primeira cobrança da matrícula (ou `integral`), em ms. Nula se nunca abriu cobrança. */
  primeiraCobrancaEm: number | null
  /** Confirmação da matrícula (ou `integral`), em ms. Nula se não pagou. */
  matriculaPagaEm: number | null
  passosRespondidos: number
  /** Lembretes já enviados com sucesso, com a data do envio em ms. */
  enviados: Partial<Record<TipoDeLembrete, number>>
}

export function lembreteDevido(c: Candidato, agora: number): TipoDeLembrete | null {
  if (!c.email || c.lembretesDesligados || c.status === 'cancelada') return null

  if (c.matriculaPagaEm === null) {
    if (c.primeiraCobrancaEm === null) return null
    const idade = agora - c.primeiraCobrancaEm
    if (idade > DIAS_MAXIMOS_PAGAMENTO * DIA) return null

    const primeiro = c.enviados.lembrete_pagamento_1
    if (primeiro === undefined) return idade >= HORAS_ATE_PRIMEIRO * HORA ? 'lembrete_pagamento_1' : null
    if (c.enviados.lembrete_pagamento_2 !== undefined) return null
    return agora - primeiro >= DIAS_ENTRE_LEMBRETES * DIA - FOLGA_MS ? 'lembrete_pagamento_2' : null
  }

  if (c.status === 'triagem_concluida' || c.passosRespondidos >= 8) return null
  if (c.enviados.lembrete_triagem !== undefined) return null
  const desdeOPagamento = agora - c.matriculaPagaEm
  if (desdeOPagamento > DIAS_MAXIMOS_TRIAGEM * DIA) return null
  return desdeOPagamento >= HORAS_ATE_LEMBRETE_TRIAGEM * HORA ? 'lembrete_triagem' : null
}
