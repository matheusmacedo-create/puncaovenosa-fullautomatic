import { enviarModelo, kapsoConfigurado, modeloDaEtapa } from '@/lib/kapso'
import { maskPhone } from '@/lib/enrollment'
import {
  comNonoDigito, dentroDoHorario, etapaDevida, linkDeVolta, numeroDoWhatsapp, previa, semNonoDigito, variaveisDoModelo,
  type CobrancaParaRecuperar, type EnvioAnterior, type EtapaDeRecuperacao, type InscricaoParaRecuperar,
} from '@/lib/recuperacao'
import { siteUrl } from '@/lib/site-url'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * A recuperação de alunos pelo WhatsApp, do lado do servidor: lê o banco,
 * monta a fila com as regras de `lib/recuperacao.ts` e, só com a trava
 * aberta, envia pela Kapso (`lib/kapso.ts`).
 *
 * A TRAVA: nada sai enquanto `WHATSAPP_RECUPERACAO_ENVIAR` não for
 * exatamente "sim". Sem ela, a rotina diária só calcula a fila e o painel
 * mostra quem receberia o quê, com o texto — nada é enviado nem gravado.
 * Abrir a trava é decisão do responsável pela escola, nunca de quem mexe no
 * código: não defina essa variável em deploy nenhum sem o pedido dele.
 */

export const envioLigado = () => process.env.WHATSAPP_RECUPERACAO_ENVIAR?.trim() === 'sim'

/** Teto por rodada: um erro de regra não pode virar centenas de mensagens de uma vez. */
export const MAXIMO_POR_RODADA = 40

/** Até onde a leitura volta: a janela mais longa (triagem, 30 dias) com folga. */
const DIAS_LIDOS = 32

export type ItemDaFila = {
  inscricaoId: string
  nome: string
  telefone: string
  numero: string
  etapa: EtapaDeRecuperacao
  modelo: string | null
  previa: string
}

export type Fila = {
  itens: ItemDaFila[]
  /** Falso quando a migration 0017 não está no banco: sem histórico, não há como evitar repetição. */
  migracaoAplicada: boolean
  bloqueados: number
}

/** Telefone pelas duas formas que o WhatsApp usa (com e sem o nono dígito). */
const formasDoNumero = (numero: string) => [numero, semNonoDigito(numero)].filter((n): n is string => Boolean(n))

export async function montarFila(agora = Date.now()): Promise<Fila> {
  const supabase = supabaseServer()
  const desde = new Date(agora - DIAS_LIDOS * 24 * 60 * 60 * 1000).toISOString()

  const { data: inscricoes, error } = await supabase
    .from('inscricoes')
    .select('id, nome, telefone, status, criado_em')
    .in('status', ['rascunho', 'aguardando_pagamento', 'paga'])
    .gte('criado_em', desde)
    .order('criado_em', { ascending: false })
    .limit(1000)

  if (error) {
    console.error('[recuperacao] leitura das inscrições falhou:', error)
    return { itens: [], migracaoAplicada: false, bloqueados: 0 }
  }
  const ids = (inscricoes ?? []).map(i => i.id)
  if (!ids.length) return { itens: [], migracaoAplicada: true, bloqueados: 0 }

  const [{ data: pagamentos }, { data: entregas, error: erroEntregas }, { data: bloqueios, error: erroBloqueios }] = await Promise.all([
    supabase.from('pagamentos').select('inscricao_id, etapa, status, criado_em, confirmado_em').in('inscricao_id', ids),
    supabase.from('whatsapp_entregas').select('inscricao_id, etapa, criado_em').in('inscricao_id', ids).eq('sucesso', true),
    supabase.from('whatsapp_bloqueios').select('telefone'),
  ])
  const migracaoAplicada = !erroEntregas && !erroBloqueios

  const cobrancas = new Map<string, CobrancaParaRecuperar[]>()
  for (const p of pagamentos ?? []) {
    const lista = cobrancas.get(p.inscricao_id) ?? []
    lista.push({ etapa: p.etapa, status: p.status, criadoEm: p.criado_em, confirmadoEm: p.confirmado_em })
    cobrancas.set(p.inscricao_id, lista)
  }
  const enviados = new Map<string, EnvioAnterior[]>()
  for (const e of entregas ?? []) {
    const lista = enviados.get(e.inscricao_id) ?? []
    lista.push({ etapa: e.etapa, criadoEm: e.criado_em })
    enviados.set(e.inscricao_id, lista)
  }
  const bloqueado = new Set((bloqueios ?? []).map(b => b.telefone as string))

  const base = siteUrl()
  const vistos = new Set<string>()
  const itens: ItemDaFila[] = []
  let bloqueados = 0

  // A lista vem da mais recente para a mais antiga: com duas inscrições no
  // mesmo telefone, vale a mais recente, e a pessoa recebe uma mensagem só.
  for (const i of (inscricoes ?? []) as (Omit<InscricaoParaRecuperar, 'criadoEm'> & { criado_em: string })[]) {
    const numero = numeroDoWhatsapp(i.telefone)
    if (!numero || vistos.has(numero)) continue
    vistos.add(numero)

    const estaBloqueado = formasDoNumero(numero).some(n => bloqueado.has(comNonoDigito(n)))
    const etapa = etapaDevida({ ...i, criadoEm: i.criado_em }, {
      agora,
      cobrancas: cobrancas.get(i.id) ?? [],
      enviados: enviados.get(i.id) ?? [],
      bloqueado: estaBloqueado,
    })
    if (estaBloqueado) bloqueados++
    if (!etapa || !base) continue

    const variaveis = variaveisDoModelo(i.nome, linkDeVolta(base, etapa))
    itens.push({
      inscricaoId: i.id,
      nome: i.nome,
      telefone: maskPhone(i.telefone),
      numero,
      etapa,
      modelo: modeloDaEtapa(etapa),
      previa: previa(etapa, variaveis),
    })
  }

  return { itens, migracaoAplicada, bloqueados }
}

export type ResultadoDaRodada =
  | { modo: 'ensaio'; devidos: number }
  | { modo: 'parado'; motivo: string; devidos: number }
  | { modo: 'envio'; devidos: number; enviados: number; falhas: number; semModelo: number }

/**
 * Uma rodada da recuperação. Chamada 1x/dia pela rotina
 * (`/api/recuperacao/whatsapp`). Com a trava fechada, só conta.
 */
export async function executarRecuperacao(agora = Date.now()): Promise<ResultadoDaRodada> {
  const fila = await montarFila(agora)
  const devidos = fila.itens.length

  if (!envioLigado()) return { modo: 'ensaio', devidos }
  if (!kapsoConfigurado()) return { modo: 'parado', motivo: 'Kapso não configurada (KAPSO_API_KEY e KAPSO_NUMERO_ID).', devidos }
  // Sem as tabelas, não há como saber quem já recebeu nem quem pediu para sair.
  if (!fila.migracaoAplicada) return { modo: 'parado', motivo: 'Migration 0017 não aplicada.', devidos }
  if (!dentroDoHorario(agora)) return { modo: 'parado', motivo: 'Fora do horário (9h às 20h de Brasília).', devidos }

  const supabase = supabaseServer()
  let enviados = 0
  let falhas = 0
  let semModelo = 0

  for (const item of fila.itens.slice(0, MAXIMO_POR_RODADA)) {
    if (!item.modelo) { semModelo++; continue }
    const base = siteUrl()!
    const resultado = await enviarModelo(item.numero, item.modelo, variaveisDoModelo(item.nome, linkDeVolta(base, item.etapa)))
    const { error } = await supabase.from('whatsapp_entregas').insert({
      inscricao_id: item.inscricaoId,
      etapa: item.etapa,
      telefone: item.numero,
      modelo: item.modelo,
      sucesso: resultado.ok,
      provedor_id: resultado.ok ? resultado.id : null,
      erro: resultado.ok ? null : resultado.erro,
    })
    // 23505 é a corrida com outra rodada: a mensagem já tinha saído por lá.
    if (error && error.code !== '23505') console.error('[recuperacao] falha ao registrar entrega:', error)
    if (resultado.ok) enviados++
    else { falhas++; console.error('[recuperacao] envio recusado:', item.etapa, resultado.erro) }
  }

  return { modo: 'envio', devidos, enviados, falhas, semModelo }
}

/**
 * Tira um telefone da recuperação, de vez. Chamado quando a pessoa responde
 * SAIR (webhook da Kapso) ou pela secretaria. Grava a forma com o nono
 * dígito, que é a de `inscricoes.telefone`. Nunca lança.
 */
export async function bloquearNumero(numeroRecebido: string, origem: 'resposta' | 'secretaria') {
  const numero = comNonoDigito(numeroRecebido)
  if (!/^55\d{11}$/.test(numero)) return false
  const { error } = await supabaseServer()
    .from('whatsapp_bloqueios')
    .upsert({ telefone: numero, origem }, { onConflict: 'telefone', ignoreDuplicates: true })
  if (error) {
    console.error('[recuperacao] falha ao gravar bloqueio:', error)
    return false
  }
  return true
}
