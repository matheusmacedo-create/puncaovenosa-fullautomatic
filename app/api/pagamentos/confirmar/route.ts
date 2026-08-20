import { NextResponse } from 'next/server'
import { corpo, erro, rota } from '@/lib/http'
import { lerInscricaoId } from '@/lib/session'
import { supabaseServer } from '@/lib/supabase/server'

type Payload = { pagamentoId?: string }

/**
 * Confirma uma cobrança e promove a inscrição.
 *
 * Hoje é chamada pelos controles de simulação da tela de pagamento. Quando
 * a Único entrar, quem chama isto é o webhook do provedor — a função
 * `confirmar_pagamento` no banco é idempotente justamente por isso: webhook
 * e clique podem chegar juntos sem gerar dois números de inscrição.
 */
export function POST(request: Request) {
  return rota(async () => {
    const inscricaoId = await lerInscricaoId()
    if (!inscricaoId) return erro('Nenhuma inscrição nesta sessão.', 401)

    const body = await corpo<Payload>(request)
    if (!body?.pagamentoId) return erro('Informe a cobrança a confirmar.', 400)

    const supabase = supabaseServer()

    // A cobrança precisa ser da inscrição desta sessão — senão qualquer um
    // confirmaria o pagamento de outra pessoa sabendo o id.
    const { data: pagamento, error: erroLeitura } = await supabase
      .from('pagamentos')
      .select('id, inscricao_id')
      .eq('id', body.pagamentoId)
      .maybeSingle()

    if (erroLeitura) {
      console.error('[funil] leitura da cobrança falhou:', erroLeitura)
      return erro('Não foi possível confirmar agora.', 502)
    }
    if (!pagamento || pagamento.inscricao_id !== inscricaoId) return erro('Cobrança não encontrada.', 404)

    const { data, error } = await supabase
      .rpc('confirmar_pagamento', { p_pagamento_id: body.pagamentoId })
      .single<{ inscricao_id: string; numero_inscricao: string | null; ja_confirmado: boolean }>()

    if (error || !data) {
      console.error('[funil] confirmar_pagamento falhou:', error)
      return erro('Não foi possível confirmar o pagamento.', 502)
    }

    return NextResponse.json({
      numeroInscricao: data.numero_inscricao,
      jaConfirmado: data.ja_confirmado,
    })
  })
}
