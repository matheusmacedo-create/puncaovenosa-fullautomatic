import { NextResponse } from 'next/server'
import { corpo, erro, rota } from '@/lib/http'
import { lerInscricaoId } from '@/lib/session'
import { confirmacaoManualPermitida } from '@/lib/simulacao'
import { supabaseServer } from '@/lib/supabase/server'

type Desfecho = 'expirado' | 'recusado'
type Payload = { pagamentoId?: string; desfecho?: Desfecho; motivo?: string }

const PERMITIDOS: Desfecho[] = ['expirado', 'recusado']

/**
 * Encerra uma cobrança sem sucesso: o PIX estourou o prazo ou o cartão foi
 * recusado. Só age sobre cobrança ainda pendente, para não sobrescrever um
 * pagamento já confirmado por corrida com o webhook.
 */
export function POST(request: Request) {
  return rota(async () => {
    const inscricaoId = await lerInscricaoId()
    if (!inscricaoId) return erro('Nenhuma inscrição nesta sessão.', 401)

    const body = await corpo<Payload>(request)
    if (!body?.pagamentoId) return erro('Informe a cobrança.', 400)
    if (!body.desfecho || !PERMITIDOS.includes(body.desfecho)) return erro('Desfecho inválido.', 422)
    // 'expirado' é legítimo: o contador do próprio aluno estourou. Já
    // 'recusado' só chega de verdade pelo provedor, então aqui é simulação.
    if (body.desfecho === 'recusado' && !confirmacaoManualPermitida()) {
      return erro('Recusa manual desativada. O provedor informa a recusa.', 403)
    }

    const { data, error } = await supabaseServer()
      .from('pagamentos')
      .update({ status: body.desfecho, recusa_motivo: body.motivo ?? null })
      .eq('id', body.pagamentoId)
      .eq('inscricao_id', inscricaoId)
      .eq('status', 'pendente')
      .select('id, status')
      .maybeSingle()

    if (error) {
      console.error('[funil] desfecho de pagamento falhou:', error)
      return erro('Não foi possível atualizar a cobrança.', 502)
    }

    // Sem linha afetada: a cobrança já saiu de "pendente". Não é erro.
    return NextResponse.json({ alterado: !!data, status: data?.status ?? null })
  })
}
