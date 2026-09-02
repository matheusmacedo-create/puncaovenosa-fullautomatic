import { NextResponse } from 'next/server'
import { corpo, erro, rota } from '@/lib/http'
import { traduzirStatus } from '@/lib/pagamento-status'
import { enviarConversaoMeta } from '@/lib/meta-capi'
import { removerDoPublicoDeAbandono } from '@/lib/meta-audiencia'
import { espelharNaPlanilha } from '@/lib/planilha'
import { supabaseServer } from '@/lib/supabase/server'
import { consultarTransacao } from '@/lib/unicopag'
import { enviarComprovanteDePagamento } from '@/lib/email'
import { notificarSecretaria } from '@/lib/webhook-secretaria'

/**
 * A criação de cobrança no cartão leva por volta de 11 segundos na Únicopag,
 * e o limite padrão de uma função na Vercel é 10. Sem isto, o aluno receberia
 * erro numa cobrança que talvez tenha sido criada — o pior tipo de falha num
 * checkout. 60s dá folga confortável.
 */
export const maxDuration = 60


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
      .select('id, status, inscricao_id')
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
      // Só na transição: o provedor pode reenviar o mesmo aviso, e a planilha
      // não precisa ser reescrita a cada repetição.
      if (!data.ja_confirmado) {
        espelharNaPlanilha(pagamento.inscricao_id)
        notificarSecretaria(pagamento.inscricao_id, 'pagamento_confirmado')
        // Sem `contexto`: esta requisição vem do servidor da Únicopag, não do
        // navegador do aluno — passar o IP/user-agent daqui envenenaria a
        // correspondência avançada no Meta em vez de melhorá-la.
        enviarConversaoMeta(pagamento.inscricao_id, 'pago', { pagamentoId: pagamento.id })
        enviarComprovanteDePagamento(pagamento.inscricao_id, pagamento.id)
        removerDoPublicoDeAbandono(pagamento.inscricao_id)
      }
      return NextResponse.json({ ok: true, status, jaConfirmado: data.ja_confirmado })
    }

    // Desfechos sem sucesso só valem enquanto a cobrança ainda está pendente:
    // um pagamento já confirmado não pode ser rebaixado por um aviso atrasado.
    if (status === 'recusado' || status === 'expirado' || status === 'estornado') {
      const { data: atualizados, error } = await supabase
        .from('pagamentos')
        .update({ status })
        .eq('id', pagamento.id)
        .eq('status', 'pendente')
        .select('id')
      if (error) console.error('[funil] webhook: atualização falhou:', error)
      // Recusa e expiração também interessam a quem acompanha pela planilha.
      else if (atualizados?.length) {
        espelharNaPlanilha(pagamento.inscricao_id)
        notificarSecretaria(pagamento.inscricao_id, 'pagamento_falhou')
      }
    }

    return NextResponse.json({ ok: true, status })
  })
}
