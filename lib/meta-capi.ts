import { createHash } from 'node:crypto'
import { after } from 'next/server'
import { type Etapa, ETAPAS, type NomeDaEtapa } from '@/lib/etapas-funil'
import { PIXEL_ID } from '@/lib/pixel-id'
import { siteUrl } from '@/lib/site-url'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * Conversions API do Meta: a mesma etapa do funil, enviada pelo servidor,
 * além do pixel no navegador.
 *
 * Existe por dois motivos. Primeiro, cobertura: bloqueador de anúncio,
 * Safari/ITP e navegador com rastreamento restrito derrubam uma fatia real
 * dos eventos que dependem só do navegador, sem ninguém perceber que
 * sumiram. Segundo, qualidade: o servidor tem e-mail, telefone e CPF da
 * inscrição prontos para a correspondência avançada do Meta (hash de
 * `em`/`ph`/`external_id`) — dado que o navegador nem sempre capturou a
 * tempo do evento, ou nunca captura (CPF nunca passou pelo pixel).
 *
 * O `event_id` enviado aqui precisa ser idêntico ao `eventID` que
 * `lib/rastreio.ts` manda no navegador para o Meta deduplicar os dois como
 * um evento só, em vez de contar a venda duas vezes — por isso os nomes de
 * etapa vêm de `lib/etapas-funil.ts`, e não de uma cópia local.
 *
 * Nunca lança: o Meta fora do ar ou o token vencido não podem derrubar uma
 * inscrição. Toda tentativa fica registrada em `meta_capi_entregas`, que é
 * o que o bloco "Checkpoint do Pixel" em /secretaria lê.
 */

const VERSAO_API = 'v21.0'

/** As únicas etapas com evento padrão do Meta — as outras (triagemInicio, ficha) não têm o que enviar à Conversions API. */
export const ETAPAS_COM_CAPI: readonly NomeDaEtapa[] = (Object.keys(ETAPAS) as NomeDaEtapa[]).filter(chave => ETAPAS[chave].evento !== null)

const TOKEN = () => process.env.META_CAPI_TOKEN?.trim()
// Código de teste do Events Manager (aba "Testar eventos"), opcional — com
// ele definido, os eventos aparecem lá em tempo real para conferência, sem
// entrar nas métricas de campanha. Remova a variável para produção normal.
const CODIGO_DE_TESTE = () => process.env.META_CAPI_TEST_EVENT_CODE?.trim()

/** Sem PIXEL_ID (dataset) e sem o token, a Conversions API simplesmente não dispara. */
export function metaCapiConfigurado() {
  return Boolean(PIXEL_ID && TOKEN())
}

type Contexto = { ip: string | null; userAgent: string | null; fbp: string | null; fbc: string | null }

/**
 * IP, user-agent e os cookies `_fbp`/`_fbc` da requisição do próprio aluno —
 * são sinais que só existem quando quem chama tem o `Request` original.
 * Não use isto num postback de terceiro (Únicopag): ali `request` é do
 * servidor deles, não do navegador do aluno, e passaria o IP errado ao Meta.
 */
export function contextoDoNavegador(request: Request): Contexto {
  const cookie = request.headers.get('cookie') ?? ''
  const fbp = cookie.match(/(?:^|;\s*)_fbp=([^;]+)/)?.[1] ?? null
  const fbc = cookie.match(/(?:^|;\s*)_fbc=([^;]+)/)?.[1] ?? null
  return {
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: request.headers.get('user-agent'),
    fbp,
    fbc,
  }
}

const hash = (valor: string) => createHash('sha256').update(valor.trim().toLowerCase()).digest('hex')

function nomeESobrenome(nomeCompleto: string) {
  const [primeiro, ...resto] = nomeCompleto.trim().split(/\s+/)
  return { primeiro, sobrenome: resto.join(' ') || null }
}

type DadosDaInscricao = { nome: string; cpf: string; telefone: string; email: string | null }

function montarUserData(inscricao: DadosDaInscricao, contexto?: Contexto) {
  const { primeiro, sobrenome } = nomeESobrenome(inscricao.nome)
  return {
    // Hash sempre em minúsculo e sem espaço nas pontas — é a exigência do Meta.
    external_id: hash(inscricao.cpf),
    ph: hash(inscricao.telefone),
    ...(inscricao.email ? { em: hash(inscricao.email) } : {}),
    fn: hash(primeiro),
    ...(sobrenome ? { ln: hash(sobrenome) } : {}),
    ...(contexto?.ip ? { client_ip_address: contexto.ip } : {}),
    ...(contexto?.userAgent ? { client_user_agent: contexto.userAgent } : {}),
    ...(contexto?.fbp ? { fbp: contexto.fbp } : {}),
    ...(contexto?.fbc ? { fbc: contexto.fbc } : {}),
  }
}

async function buscarDados(inscricaoId: string, pagamentoId?: string) {
  const supabase = supabaseServer()

  const { data: inscricao, error } = await supabase
    .from('inscricoes')
    .select('nome, cpf, telefone, email')
    .eq('id', inscricaoId)
    .maybeSingle()

  if (error || !inscricao) {
    console.error('[meta-capi] inscrição não encontrada:', inscricaoId, error)
    return null
  }

  let valorCentavos: number | null = null
  if (pagamentoId) {
    const { data: pagamento } = await supabase
      .from('pagamentos')
      .select('valor_centavos')
      .eq('id', pagamentoId)
      .maybeSingle()
    valorCentavos = pagamento?.valor_centavos ?? null
  }

  return { inscricao, valorCentavos }
}

async function registrar(
  inscricaoId: string,
  nomeDoEvento: string,
  pagamentoId: string | null,
  payload: unknown,
  sucesso: boolean,
  statusHttp: number | null,
  erro: string | null,
) {
  const { error } = await supabaseServer().from('meta_capi_entregas').insert({
    inscricao_id: inscricaoId,
    evento: nomeDoEvento,
    pagamento_id: pagamentoId,
    payload,
    sucesso,
    status_http: statusHttp,
    erro,
  })
  if (error) console.error('[meta-capi] falha ao registrar entrega:', error)
}

async function enviar(inscricaoId: string, etapa: NomeDaEtapa, opts: { pagamentoId?: string; contexto?: Contexto }) {
  const { nome, evento, comValor } = ETAPAS[etapa] as Etapa
  // Etapas sem evento padrão do Meta (triagemInicio, ficha) não interessam
  // à Conversions API — só existem como marco do dataLayer.
  if (!evento) return

  const dados = await buscarDados(inscricaoId, opts.pagamentoId)
  if (!dados) return
  const { inscricao, valorCentavos } = dados

  const customData: Record<string, unknown> = { content_name: 'Curso de Punção Venosa' }
  if (comValor) {
    if (valorCentavos === null) {
      console.error(`[meta-capi] etapa "${nome}" precisa de valor e não encontrou a cobrança — evento não enviado.`)
      await registrar(inscricaoId, nome, opts.pagamentoId ?? null, null, false, null, 'sem cobrança para calcular o valor')
      return
    }
    customData.value = valorCentavos / 100
    customData.currency = 'BRL'
  }

  // O mesmo id que o pixel do navegador usa no `eventID` — é o que faz o
  // Meta reconhecer as duas chamadas como o mesmo evento, não duas vendas.
  const eventId = `${nome}:${opts.pagamentoId ?? inscricaoId}`

  const corpo = {
    data: [{
      event_name: evento,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      event_source_url: siteUrl() ?? undefined,
      action_source: 'website',
      user_data: montarUserData(inscricao, opts.contexto),
      custom_data: customData,
    }],
    ...(CODIGO_DE_TESTE() ? { test_event_code: CODIGO_DE_TESTE() } : {}),
  }

  try {
    const resposta = await fetch(
      `https://graph.facebook.com/${VERSAO_API}/${PIXEL_ID}/events?access_token=${encodeURIComponent(TOKEN()!)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(10_000),
      },
    )

    if (resposta.ok) {
      await registrar(inscricaoId, nome, opts.pagamentoId ?? null, corpo, true, resposta.status, null)
    } else {
      const texto = await resposta.text().catch(() => '')
      // Nunca logar a URL da requisição aqui: ela carrega o access_token.
      console.error('[meta-capi] recusado:', resposta.status, texto)
      await registrar(inscricaoId, nome, opts.pagamentoId ?? null, corpo, false, resposta.status, texto.slice(0, 500) || null)
    }
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : 'falha desconhecida'
    console.error('[meta-capi] falhou ao enviar:', e)
    await registrar(inscricaoId, nome, opts.pagamentoId ?? null, corpo, false, null, mensagem)
  }
}

/** Agenda o envio para depois da resposta ao aluno. Sem configuração, é um no-op. */
export function enviarConversaoMeta(inscricaoId: string, etapa: NomeDaEtapa, opts: { pagamentoId?: string; contexto?: Contexto } = {}) {
  if (!metaCapiConfigurado()) return
  after(() => enviar(inscricaoId, etapa, opts))
}

/** Reenvio manual, disparado da tela /secretaria para uma entrega que falhou. */
export async function reenviarConversaoMeta(inscricaoId: string, etapa: NomeDaEtapa, pagamentoId?: string) {
  if (!metaCapiConfigurado()) throw new Error('Conversions API não está configurada.')
  await enviar(inscricaoId, etapa, { pagamentoId })
}
