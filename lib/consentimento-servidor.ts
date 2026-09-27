import { type Consentimento, consentimentoDaRequisicao } from '@/lib/consentimento'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * A escolha de marketing guardada na inscrição (colunas da migration 0016).
 *
 * Existe para os envios ao Meta que acontecem sem navegador nenhum — o
 * postback da Únicopag que confirma o pagamento, o reenvio manual em
 * /secretaria, o cron do público de remarketing —, onde não há cookie
 * `cvrj_consentimento` para ler. É gravada a partir do cookie das requisições
 * do próprio aluno: cadastro, abertura de cobrança e cada escolha feita no
 * aviso de cookies com a sessão aberta (POST /api/consentimento).
 *
 * Nulo, erro de leitura ou coluna ainda inexistente (migration 0016 não
 * aplicada) valem como "sem consentimento": na dúvida, nada vai ao Meta. E
 * nada aqui lança — uma falha de gravação nunca pode derrubar uma inscrição
 * nem uma cobrança.
 */

/** Grava na inscrição a escolha que veio no cookie desta requisição (nenhuma escolha também é gravada: vira nulo). */
export async function gravarConsentimentoDaRequisicao(inscricaoId: string, request: Request) {
  await gravarConsentimentoNaInscricao(inscricaoId, consentimentoDaRequisicao(request))
}

export async function gravarConsentimentoNaInscricao(inscricaoId: string, consentimento: Consentimento | null) {
  const valor = consentimento ? consentimento.marketing : null
  const em = consentimento ? new Date((consentimento.em || Math.floor(Date.now() / 1000)) * 1000).toISOString() : null
  try {
    // Só grava quando muda: cada UPDATE mexe em `atualizado_em` (trigger), que
    // o painel, a planilha e o webhook mostram como "atualizada em".
    const { error } = await supabaseServer()
      .from('inscricoes')
      .update({ consentimento_marketing: valor, consentimento_marketing_em: em })
      .eq('id', inscricaoId)
      .not('consentimento_marketing', 'is', valor)
    if (error) console.error('[consentimento] escolha de marketing não gravada na inscrição (a migration 0016 foi aplicada?):', error.message)
  } catch (e) {
    console.error('[consentimento] falha ao gravar a escolha de marketing:', e)
  }
}

/** A inscrição tem consentimento de marketing gravado? Só `true` explícito conta. */
export async function marketingConsentidoNaInscricao(inscricaoId: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseServer()
      .from('inscricoes')
      .select('consentimento_marketing')
      .eq('id', inscricaoId)
      .maybeSingle()
    if (error) {
      console.error('[consentimento] escolha de marketing ilegível (a migration 0016 foi aplicada?):', error.message)
      return false
    }
    return data?.consentimento_marketing === true
  } catch (e) {
    console.error('[consentimento] falha ao ler a escolha de marketing:', e)
    return false
  }
}
