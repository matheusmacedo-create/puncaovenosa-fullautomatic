import { after } from 'next/server'
import { hash, telefoneInternacional } from '@/lib/meta-hash'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * Público personalizado de remarketing no Meta: quem preencheu nome,
 * telefone e e-mail no funil e não pagou depois de um tempo.
 *
 * Dois fluxos, com timing diferente e propósito diferente:
 *
 * - `sincronizarAbandonados` (POST /api/meta-audiencia/sync, chamado 1x/dia
 *   pelo cron da Vercel — o plano Hobby não libera mais que isso) varre
 *   `inscricoes` por quem ainda não converteu depois da janela de espera e
 *   sobe a lista, com hash, para o público. `meta_publico_membros` é o que
 *   impede subir a mesma inscrição duas vezes.
 * - `removerDoPublicoDeAbandono` roda em tempo real, chamada do mesmo lugar
 *   onde já disparamos o evento `pago` da Conversions API — sem isso,
 *   continuaríamos pagando anúncio de remarketing para quem já comprou até
 *   a próxima rodada do cron, até 24h depois.
 *
 * Nunca lança: o Meta fora do ar não pode derrubar a confirmação de
 * pagamento nem a criação da inscrição.
 */

const VERSAO_API = 'v21.0'

const TOKEN = () => process.env.META_MARKETING_TOKEN?.trim()
const AUDIENCE_ID = () => process.env.META_AUDIENCE_ABANDONADOS_ID?.trim()

/** Sem o token da Marketing API e sem o público já criado, a sincronização é um no-op. */
export function audienciaConfigurada() {
  return Boolean(TOKEN() && AUDIENCE_ID())
}

/** Horas sem pagar, contadas da criação da inscrição, para entrar no público. */
export const JANELA_DE_ABANDONO_HORAS = 2

type Lead = { id: string; email: string; telefone: string }

function payloadDeUsuarios(leads: Lead[]) {
  return {
    schema: ['EMAIL', 'PHONE'],
    data: leads.map(l => [hash(l.email), hash(telefoneInternacional(l.telefone))]),
  }
}

async function chamarGraphApi(metodo: 'POST' | 'DELETE', leads: Lead[]) {
  const corpo = { payload: payloadDeUsuarios(leads) }
  const resposta = await fetch(
    `https://graph.facebook.com/${VERSAO_API}/${AUDIENCE_ID()}/users?access_token=${encodeURIComponent(TOKEN()!)}`,
    {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(15_000),
    },
  )
  if (!resposta.ok) {
    const texto = await resposta.text().catch(() => '')
    // Nunca logar a URL: ela carrega o access_token.
    throw new Error(`Meta recusou (${resposta.status}): ${texto.slice(0, 500)}`)
  }
}

/**
 * Cria o público personalizado uma única vez. Chamado por uma rota
 * autenticada em /secretaria — o id retornado vai para
 * META_AUDIENCE_ABANDONADOS_ID na Vercel, manualmente, uma vez só.
 */
export async function criarPublicoDeAbandono(adAccountId: string) {
  if (!TOKEN()) throw new Error('META_MARKETING_TOKEN não configurado.')
  const resposta = await fetch(
    `https://graph.facebook.com/${VERSAO_API}/${adAccountId}/customaudiences?access_token=${encodeURIComponent(TOKEN()!)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Funil Punção Venosa — abandonou sem pagar',
        description: `Preencheu nome, telefone e e-mail no funil e não pagou depois de ${JANELA_DE_ABANDONO_HORAS}h. Sincronizado automaticamente 1x/dia; removido em tempo real ao pagar.`,
        subtype: 'CUSTOM',
        customer_file_source: 'USER_PROVIDED_ONLY',
      }),
      signal: AbortSignal.timeout(15_000),
    },
  )
  if (!resposta.ok) {
    const texto = await resposta.text().catch(() => '')
    throw new Error(`Meta recusou a criação do público (${resposta.status}): ${texto.slice(0, 500)}`)
  }
  return (await resposta.json()) as { id: string }
}

/**
 * Varre quem preencheu o funil e não pagou depois da janela de espera, e
 * ainda não foi enviado ao público. Retorna quantos foram adicionados.
 */
export async function sincronizarAbandonados() {
  if (!audienciaConfigurada()) return { adicionados: 0, falhas: 0 }
  const supabase = supabaseServer()

  const { data: candidatos, error } = await supabase
    .from('inscricoes')
    .select('id, email, telefone')
    .in('status', ['rascunho', 'aguardando_pagamento'])
    .lt('criado_em', new Date(Date.now() - JANELA_DE_ABANDONO_HORAS * 60 * 60 * 1000).toISOString())

  if (error) {
    console.error('[meta-audiencia] falha ao buscar candidatos:', error)
    return { adicionados: 0, falhas: 0 }
  }
  if (!candidatos?.length) return { adicionados: 0, falhas: 0 }

  const { data: jaMembros } = await supabase
    .from('meta_publico_membros')
    .select('inscricao_id')
    .in('inscricao_id', candidatos.map(c => c.id))
  const jaEnviados = new Set((jaMembros ?? []).map(m => m.inscricao_id))

  const pendentes = candidatos.filter(c => !jaEnviados.has(c.id) && c.email && c.telefone) as Lead[]
  if (!pendentes.length) return { adicionados: 0, falhas: 0 }

  // Lotes de 500: bem acima do volume real do funil, só para nunca montar
  // um POST gigante caso o abandono acumule por algum motivo.
  const LOTE = 500
  let adicionados = 0
  let falhas = 0

  for (let i = 0; i < pendentes.length; i += LOTE) {
    const lote = pendentes.slice(i, i + LOTE)
    try {
      await chamarGraphApi('POST', lote)
      // Só grava linha em caso de sucesso: falha aqui não marca ninguém como
      // "já enviado", então o próprio cron do dia seguinte tenta de novo —
      // sem precisar de um reenvio manual para uma falha transitória.
      await supabase.from('meta_publico_membros').insert(lote.map(l => ({ inscricao_id: l.id })))
      adicionados += lote.length
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : 'falha desconhecida'
      console.error('[meta-audiencia] falha ao adicionar lote:', mensagem)
      falhas += lote.length
    }
  }

  return { adicionados, falhas }
}

async function removerMembro(membroId: string, inscricaoId: string, email: string, telefone: string) {
  const supabase = supabaseServer()
  try {
    await chamarGraphApi('DELETE', [{ id: inscricaoId, email, telefone }])
    await supabase.from('meta_publico_membros').update({ removido_em: new Date().toISOString() }).eq('id', membroId)
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : 'falha desconhecida'
    console.error('[meta-audiencia] falha ao remover:', mensagem)
    await supabase.from('meta_publico_membros').update({ erro: mensagem }).eq('id', membroId)
  }
}

async function removerUm(inscricaoId: string) {
  const supabase = supabaseServer()
  const { data: membro } = await supabase
    .from('meta_publico_membros')
    .select('id')
    .eq('inscricao_id', inscricaoId)
    .is('removido_em', null)
    .maybeSingle()
  if (!membro) return // nunca foi adicionado, ou já removido — nada a fazer

  const { data: inscricao } = await supabase
    .from('inscricoes')
    .select('email, telefone')
    .eq('id', inscricaoId)
    .maybeSingle()
  if (!inscricao) return

  await removerMembro(membro.id, inscricaoId, inscricao.email, inscricao.telefone)
}

/** Agenda a remoção para depois da resposta — chamar do mesmo lugar que confirma o pagamento. */
export function removerDoPublicoDeAbandono(inscricaoId: string) {
  if (!audienciaConfigurada()) return
  after(() => removerUm(inscricaoId))
}

/**
 * Rede de segurança da rotina diária: alguém que já pagou mas cuja remoção
 * em tempo real falhou (Meta fora do ar no momento da confirmação) fica
 * pendurado no público para sempre sem isto — aqui ele é varrido de novo.
 */
export async function retentarRemocoesPendentes() {
  if (!audienciaConfigurada()) return { removidos: 0 }
  const supabase = supabaseServer()

  const { data: pendentes, error } = await supabase
    .from('meta_publico_membros')
    .select('id, inscricao_id, inscricoes!inner(status, email, telefone)')
    .is('removido_em', null)
    .in('inscricoes.status', ['paga', 'triagem_concluida'])

  if (error) {
    console.error('[meta-audiencia] falha ao buscar remoções pendentes:', error)
    return { removidos: 0 }
  }
  if (!pendentes?.length) return { removidos: 0 }

  for (const p of pendentes) {
    const inscricao = p.inscricoes as unknown as { email: string; telefone: string }
    await removerMembro(p.id, p.inscricao_id, inscricao.email, inscricao.telefone)
  }
  return { removidos: pendentes.length }
}
