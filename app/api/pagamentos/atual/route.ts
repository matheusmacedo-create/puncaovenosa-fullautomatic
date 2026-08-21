import { NextResponse } from 'next/server'
import { erro, rota } from '@/lib/http'
import { lerInscricaoId } from '@/lib/session'
import { confirmacaoManualPermitida, simulacaoAtiva } from '@/lib/simulacao'
import { traduzirStatus } from '@/lib/pagamento-status'
import { consultarTransacao } from '@/lib/unicopag'
import { supabaseServer } from '@/lib/supabase/server'
import { MINUTOS_PARA_EXPIRAR } from '@/lib/enrollment'

/**
 * A criação de cobrança no cartão leva por volta de 11 segundos na Únicopag,
 * e o limite padrão de uma função na Vercel é 10. Sem isto, o aluno receberia
 * erro numa cobrança que talvez tenha sido criada — o pior tipo de falha num
 * checkout. 60s dá folga confortável.
 */
export const maxDuration = 60


/**
 * Última cobrança da inscrição. A tela de pagamento consulta isto em
 * intervalos para descobrir que o pagamento caiu, sem o aluno precisar
 * recarregar a página.
 */
export function GET() {
  return rota(async () => {
    const inscricaoId = await lerInscricaoId()
    if (!inscricaoId) return erro('Nenhuma inscrição nesta sessão.', 401)

    const { data, error } = await supabaseServer()
      .from('pagamentos')
      .select('id, metodo, parcelas, valor_centavos, itens, status, provedor_id, pix_copia_cola, recusa_motivo, criado_em')
      .eq('inscricao_id', inscricaoId)
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[funil] leitura de pagamento falhou:', error)
      return erro('Não foi possível consultar o pagamento.', 502)
    }
    if (!data) return NextResponse.json({ existe: false, simulacao: simulacaoAtiva(), confirmacaoManual: confirmacaoManualPermitida() })

    // Pergunta ao provedor em vez de esperar o aviso dele.
    //
    // O postback pode falhar, atrasar ou nem chegar — e nesse caso o aluno
    // teria pagado e continuaria olhando para a tela de espera. Como esta
    // rota já é consultada em intervalos pela tela de pagamento, ela é o
    // lugar natural para confirmar por conta própria.
    let status = data.status
    if (status === 'pendente' && data.provedor_id && process.env.UNICO_API_KEY?.trim()) {
      try {
        const transacao = await consultarTransacao(data.provedor_id)
        const noProvedor = traduzirStatus(transacao.payment_status)
        if (noProvedor === 'confirmado') {
          await supabaseServer().rpc('confirmar_pagamento', { p_pagamento_id: data.id })
          status = 'confirmado'
        } else if (noProvedor !== 'pendente') {
          await supabaseServer().from('pagamentos').update({ status: noProvedor }).eq('id', data.id).eq('status', 'pendente')
          status = noProvedor
        }
      } catch (e) {
        // Provedor fora do ar não pode derrubar a tela: seguimos com o que o
        // banco sabe, e a próxima consulta tenta de novo.
        console.error('[funil] consulta ao provedor falhou:', e)
      }
    }

    return NextResponse.json({
      existe: true,
      id: data.id,
      metodo: data.metodo,
      parcelas: data.parcelas,
      valorCentavos: data.valor_centavos,
      itens: data.itens,
      status,
      pixCopiaCola: data.pix_copia_cola,
      recusaMotivo: data.recusa_motivo,
      criadoEm: data.criado_em,
      minutosParaExpirar: MINUTOS_PARA_EXPIRAR,
      simulacao: simulacaoAtiva(),
      confirmacaoManual: confirmacaoManualPermitida(),
    })
  })
}
