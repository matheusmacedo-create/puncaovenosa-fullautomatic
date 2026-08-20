import { NextResponse } from 'next/server'
import { erro, rota } from '@/lib/http'
import { lerInscricaoId } from '@/lib/session'
import { supabaseServer } from '@/lib/supabase/server'
import { MINUTOS_PARA_EXPIRAR } from '@/lib/enrollment'

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
      .select('id, metodo, parcelas, valor_centavos, status, pix_copia_cola, recusa_motivo, criado_em')
      .eq('inscricao_id', inscricaoId)
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[funil] leitura de pagamento falhou:', error)
      return erro('Não foi possível consultar o pagamento.', 502)
    }
    if (!data) return NextResponse.json({ existe: false })

    return NextResponse.json({
      existe: true,
      id: data.id,
      metodo: data.metodo,
      parcelas: data.parcelas,
      valorCentavos: data.valor_centavos,
      status: data.status,
      pixCopiaCola: data.pix_copia_cola,
      recusaMotivo: data.recusa_motivo,
      criadoEm: data.criado_em,
      minutosParaExpirar: MINUTOS_PARA_EXPIRAR,
    })
  })
}
