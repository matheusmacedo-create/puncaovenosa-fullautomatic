import { NextResponse } from 'next/server'
import { corpo, erro, rota } from '@/lib/http'
import { traduzirStatus } from '@/lib/pagamento-status'
import { supabaseServer } from '@/lib/supabase/server'
import { consultarTransacao } from '@/lib/unicopag'

type Postback = { event?: string; hash?: string; id?: string; payment_status?: string }

/**
 * Postback da Únicopag: o aviso de que uma transação mudou de estado.
 *
 * O corpo recebido NÃO é usado como fonte da verdade. A documentação não
 * descreve assinatura nem segredo compartilhado no postback, então qualquer
 * um que descobrisse esta URL poderia forjar um "pago" e ganhar uma vaga sem
 * pagar. O que chega aqui serve apenas como gatilho: o hash é usado para
 * perguntar à própria API qual é o status real, e é essa resposta que decide.
 *
 * Sempre respondemos 200 quando a notificação foi compreendida, mesmo que
 * não haja nada a fazer — um erro faria o provedor reenfileirar e repetir
 * indefinidamente.
 */
export function POST(request: Request) {
  return rota(async () => {
    const body = await corpo<Postback>(request)
    if (!body) return erro('Corpo da requisição inválido.', 400)

    const hash = (body.hash ?? body.id)?.trim()
    if (!hash) return erro('Postback sem hash da transação.', 400)

    const supabase = supabaseServer()
    const { data: pagamento, error: erroLeitura } = await supabase
      .from('pagamentos')
      .select('id, status')
      .eq('provedor_id', hash)
      .maybeSingle()

    if (erroLeitura) {
      console.error('[funil] webhook: leitura falhou:', erroLeitura)
      return erro('Erro ao localizar a cobrança.', 502)
    }
    if (!pagamento) {
      // Transação de outra origem, ou cobrança já removida. Não é erro nosso.
      console.warn('[funil] webhook: hash desconhecido:', hash)
      return NextResponse.json({ ok: true, ignorado: 'cobrança não encontrada' })
    }

    // A verificação que importa: perguntar ao provedor, não acreditar no corpo.
    const transacao = await consultarTransacao(hash)
    const status = traduzirStatus(transacao.payment_status)

    if (status === 'confirmado') {
      const { data, error } = await supabase
        .rpc('confirmar_pagamento', { p_pagamento_id: pagamento.id })
        .single<{ numero_inscricao: string | null; ja_confirmado: boolean }>()

      if (error || !data) {
        console.error('[funil] webhook: confirmação falhou:', error)
        return erro('Não foi possível confirmar.', 502)
      }
      return NextResponse.json({ ok: true, status, jaConfirmado: data.ja_confirmado })
    }

    // Desfechos sem sucesso só valem enquanto a cobrança ainda está pendente:
    // um pagamento já confirmado não pode ser rebaixado por um aviso atrasado.
    if (status === 'recusado' || status === 'expirado' || status === 'estornado') {
      const { error } = await supabase
        .from('pagamentos')
        .update({ status })
        .eq('id', pagamento.id)
        .eq('status', 'pendente')
      if (error) console.error('[funil] webhook: atualização falhou:', error)
    }

    return NextResponse.json({ ok: true, status })
  })
}
