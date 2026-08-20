import { NextResponse } from 'next/server'
import { corpo, erro, rota } from '@/lib/http'
import { supabaseServer } from '@/lib/supabase/server'

type Payload = { txid?: string; provedorId?: string; status?: string }

/**
 * [INTEGRAÇÃO] Webhook de confirmação de pagamento.
 *
 * É por aqui que a Único (ou o PSP do PIX) avisa que o dinheiro caiu. Não
 * há sessão nem cookie numa chamada de servidor para servidor, então a
 * cobrança é localizada pelo identificador que o provedor devolve.
 *
 * Autenticação: exige o header `x-webhook-token` igual a PIX_WEBHOOK_TOKEN.
 * Sem essa variável configurada a rota responde 501 — melhor recusar do que
 * aceitar confirmação de pagamento de qualquer origem.
 *
 * Ao ligar de verdade, troque a comparação de token pela verificação de
 * assinatura que a Único documentar (geralmente HMAC do corpo cru).
 */
export function POST(request: Request) {
  return rota(async () => {
    const esperado = process.env.PIX_WEBHOOK_TOKEN
    if (!esperado) {
      console.error('[funil] webhook chamado sem PIX_WEBHOOK_TOKEN configurado')
      return erro('Webhook não configurado.', 501)
    }
    if (request.headers.get('x-webhook-token') !== esperado) return erro('Não autorizado.', 401)

    const body = await corpo<Payload>(request)
    if (!body) return erro('Corpo da requisição inválido.', 400)

    const chave = body.txid ?? body.provedorId
    if (!chave) return erro('Informe txid ou provedorId.', 400)

    const supabase = supabaseServer()
    const { data: pagamento, error: erroLeitura } = await supabase
      .from('pagamentos')
      .select('id')
      .or(`txid.eq.${chave},provedor_id.eq.${chave}`)
      .maybeSingle()

    if (erroLeitura) {
      console.error('[funil] webhook: leitura falhou:', erroLeitura)
      return erro('Erro ao localizar a cobrança.', 502)
    }
    if (!pagamento) return erro('Cobrança não encontrada.', 404)

    const { data, error } = await supabase
      .rpc('confirmar_pagamento', { p_pagamento_id: pagamento.id })
      .single<{ numero_inscricao: string | null; ja_confirmado: boolean }>()

    if (error || !data) {
      console.error('[funil] webhook: confirmação falhou:', error)
      return erro('Não foi possível confirmar.', 502)
    }

    return NextResponse.json({ ok: true, jaConfirmado: data.ja_confirmado })
  })
}
