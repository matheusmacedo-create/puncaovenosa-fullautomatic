import { PagamentoStatus } from '@/lib/enrollment'

/**
 * Tradução dos status da Únicopag para os quatro que o nosso banco conhece.
 *
 * Valores de origem conferidos na documentação: waiting_payment, pending,
 * processing, paid, refused, cancelled, refunded, chargeback, pre_chargeback.
 *
 * Um status desconhecido é tratado como pendente de propósito: inventar
 * "confirmado" liberaria uma vaga sem pagamento, e inventar "recusado"
 * cancelaria uma cobrança que talvez esteja só em análise. Pendente é o
 * único palpite que não causa dano.
 */
const MAPA: Record<string, PagamentoStatus> = {
  waiting_payment: 'pendente',
  pending: 'pendente',
  processing: 'pendente',
  paid: 'confirmado',
  refused: 'recusado',
  cancelled: 'expirado',
  refunded: 'estornado',
  chargeback: 'estornado',
  pre_chargeback: 'confirmado', // ainda pago; a contestação não terminou
}

export function traduzirStatus(origem: string | null | undefined): PagamentoStatus {
  if (!origem) return 'pendente'
  return MAPA[origem.trim().toLowerCase()] ?? 'pendente'
}

/** Status que a Únicopag considera desfecho final de sucesso. */
export const ehPago = (origem: string | null | undefined) =>
  traduzirStatus(origem) === 'confirmado'
