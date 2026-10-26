import { createHmac, timingSafeEqual } from 'node:crypto'
import type { EtapaDeRecuperacao } from '@/lib/recuperacao'

/**
 * O número de WhatsApp da escola pela Kapso (API oficial da Meta, número
 * gerenciado pela Kapso). Usado pela recuperação de alunos
 * (`lib/recuperacao-servidor.ts`).
 *
 * É outro número, e outra conta, que o do Palácio Virtual (repositório da
 * Redação, `lib/whatsapp/kapso.ts`) — o contrato da Kapso é o mesmo, e foi de
 * lá que ele veio, conferido em docs.kapso.ai:
 *
 * - envio pelo proxy da Meta, cabeçalho `X-API-Key`, formato da Cloud API
 *   (`POST /meta/whatsapp/v24.0/{phone_number_id}/messages`);
 * - estado, número e nome pela API da plataforma
 *   (`GET /platform/v1/whatsapp/phone_numbers/{id}`): no número gerenciado,
 *   as leituras pelo proxy voltam 401 da Meta mesmo com a chave certa;
 * - "CONNECTED" não garante a ligação com a Meta: o exame de saúde
 *   (`…/health`) é que diz;
 * - fora da janela de 24h só sai modelo aprovado; a recuperação manda sempre
 *   modelo, porque quem abandonou o funil nunca escreveu para este número;
 * - webhook por número, assinado com HMAC-SHA256 do corpo cru em
 *   `X-Webhook-Signature`.
 *
 * Mesmas regras de `lib/email.ts`: nunca lança, a chave nunca sai daqui (nem
 * em log, nem em mensagem de erro) e, sem as variáveis, tudo é no-op.
 * `KAPSO_API_KEY` nunca leva `NEXT_PUBLIC_` e nunca vai para arquivo do
 * repositório — só `.env.local` ou a Vercel.
 */

const META = 'https://api.kapso.ai/meta/whatsapp/v24.0'
const PLATAFORMA = 'https://api.kapso.ai/platform/v1'
const IDIOMA = 'pt_BR'

const CHAVE = () => process.env.KAPSO_API_KEY?.trim() || null
const NUMERO_ID = () => {
  const v = process.env.KAPSO_NUMERO_ID?.trim()
  return v && /^\d{5,30}$/.test(v) ? v : null
}

/** O nome do modelo aprovado de cada momento da recuperação. Sem ele, aquele momento não sai. */
const VARIAVEL_DO_MODELO: Record<EtapaDeRecuperacao, string> = {
  pix_aberto: 'KAPSO_MODELO_PIX_ABERTO',
  abandono: 'KAPSO_MODELO_ABANDONO',
  triagem_pendente: 'KAPSO_MODELO_TRIAGEM',
}

export const variavelDoModelo = (etapa: EtapaDeRecuperacao) => VARIAVEL_DO_MODELO[etapa]

// Acesso direto, e não por `process.env[nome]`: é a convenção do projeto
// (lib/supabase/server.ts), porque o Next só substitui a forma literal.
const VALOR_DO_MODELO: Record<EtapaDeRecuperacao, () => string | undefined> = {
  pix_aberto: () => process.env.KAPSO_MODELO_PIX_ABERTO,
  abandono: () => process.env.KAPSO_MODELO_ABANDONO,
  triagem_pendente: () => process.env.KAPSO_MODELO_TRIAGEM,
}

export function modeloDaEtapa(etapa: EtapaDeRecuperacao): string | null {
  const v = VALOR_DO_MODELO[etapa]()?.trim()
  return v && /^[a-z0-9_]{1,512}$/.test(v) ? v : null
}

export function kapsoConfigurado() {
  return Boolean(CHAVE() && NUMERO_ID())
}

/** Para o diagnóstico: o que está definido, sem valor nenhum. */
export function estadoDaKapso() {
  return {
    chave: Boolean(CHAVE()),
    numeroId: process.env.KAPSO_NUMERO_ID?.trim() ? (NUMERO_ID() ? 'válido' : 'formato inválido (só dígitos)') : 'ausente',
  }
}

type Resposta = { ok: boolean; status: number; dados: unknown; erro: string | null }

const objeto = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)

/** O erro no formato da Meta (`{ error: { message, code } }`) ou da plataforma (`{ error: "…" }`). */
function erroDoCorpo(dados: unknown, status: number): string {
  const d = objeto(dados)
  const e = objeto(d?.error)
  const detalhe = texto(objeto(e?.error_data)?.details) ?? texto(e?.message) ?? texto(d?.error) ?? texto(d?.message)
  const codigo = typeof e?.code === 'number' ? e.code : null
  if (codigo === 190) return 'A ligação da Kapso com a Meta para este número caiu (token inválido). Reconecte o número no painel da Kapso.'
  if (codigo === 131047) return 'Fora da janela de 24 horas: só modelo aprovado pode sair para este número.'
  if (codigo && codigo >= 132000 && codigo <= 132069) return `A Meta recusou o modelo (${codigo}${detalhe ? `: ${detalhe}` : ''}). Confira se ele está aprovado e com 2 variáveis.`
  if (status === 401 || status === 403) return 'A Kapso recusou a chave (KAPSO_API_KEY).'
  if (status === 402) return 'A Kapso recusou por falta de créditos. Confira o plano no painel da Kapso.'
  if (status === 404) return `A Kapso não achou o número (KAPSO_NUMERO_ID)${detalhe ? `: ${detalhe}` : ''}.`
  return detalhe ?? `A Kapso respondeu ${status}.`
}

async function chamar(metodo: 'GET' | 'POST' | 'PATCH', url: string, corpo?: unknown, tempoMs = 15_000): Promise<Resposta> {
  const chave = CHAVE()
  if (!chave) return { ok: false, status: 0, dados: null, erro: 'KAPSO_API_KEY não definida.' }
  const limpar = (t: string) => t.split(chave).join('[chave]').slice(0, 400)
  try {
    const resposta = await fetch(url, {
      method: metodo,
      headers: { 'X-API-Key': chave, ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: AbortSignal.timeout(tempoMs),
      cache: 'no-store',
    })
    const bruto = await resposta.text()
    let dados: unknown = null
    try { dados = bruto ? JSON.parse(bruto) : null } catch { dados = bruto }
    if (resposta.ok && !objeto(dados)?.error) return { ok: true, status: resposta.status, dados, erro: null }
    return { ok: false, status: resposta.status, dados, erro: limpar(erroDoCorpo(dados, resposta.status)) }
  } catch (e) {
    const nome = e instanceof Error ? e.name : ''
    const motivo = nome === 'TimeoutError' || nome === 'AbortError'
      ? 'A Kapso não respondeu a tempo.'
      : `Não foi possível falar com a Kapso (${e instanceof Error ? e.message : 'erro de rede'}).`
    return { ok: false, status: 0, dados: null, erro: limpar(motivo) }
  }
}

// --- Conexão ------------------------------------------------------------

export type SituacaoDoNumero =
  | { estado: 'nao_configurado' }
  | { estado: 'conectado' | 'conectando' | 'desconectado' | 'erro'; numero: string | null; nome: string | null; erro: string | null }

/** O problema que o exame de saúde aponta, ou null se está saudável (ou se a resposta não diz). */
function problemaNaSaude(dados: unknown): string | null {
  const d = objeto(dados)
  if (!d || d.status !== 'unhealthy') return null
  const checks = objeto(d.checks) ?? {}
  for (const nome of ['messaging_health', 'phone_number_access']) {
    const c = objeto(checks[nome])
    if (c?.passed === false) {
      const erro = texto(c.error) ?? ''
      return /access token|OAuth/i.test(erro)
        ? 'A ligação da Kapso com a Meta para este número caiu (token inválido). Reconecte o número no painel da Kapso.'
        : `A Kapso aponta problema no número${erro ? ` (${erro.slice(0, 160)})` : ''}.`
    }
  }
  return null
}

/** Só leitura: não manda mensagem nem muda nada na Kapso. */
export async function situacaoDoNumero(): Promise<SituacaoDoNumero> {
  const id = NUMERO_ID()
  if (!CHAVE() || !id) return { estado: 'nao_configurado' }

  const r = await chamar('GET', `${PLATAFORMA}/whatsapp/phone_numbers/${id}`)
  if (!r.ok) return { estado: 'erro', numero: null, nome: null, erro: r.erro }

  const d = objeto(objeto(r.dados)?.data) ?? objeto(r.dados)
  const status = String(d?.status ?? '').toUpperCase()
  const estado = status === 'CONNECTED' ? 'conectado'
    : status === 'PENDING' || status === 'CONNECTING' || status === 'IN_PROGRESS' ? 'conectando'
    : status ? 'desconectado' : 'erro'
  const numero = texto(d?.display_phone_number) ?? texto(d?.display_phone_number_normalized)
  const nome = (texto(d?.verified_name) ?? texto(d?.display_name))?.slice(0, 80) ?? null

  if (estado !== 'conectado') {
    return { estado, numero, nome, erro: estado === 'erro' ? 'A Kapso não disse o estado do número.' : null }
  }
  // A Kapso limita o exame a um a cada 5 minutos; sem resposta, vale o estado.
  const saude = await chamar('GET', `${PLATAFORMA}/whatsapp/phone_numbers/${id}/health`)
  const problema = saude.ok ? problemaNaSaude(saude.dados) : null
  return problema ? { estado: 'erro', numero, nome, erro: problema } : { estado, numero, nome, erro: null }
}

// --- Envio ----------------------------------------------------------------

export type Envio = { ok: true; id: string | null } | { ok: false; erro: string }

/**
 * Manda um modelo aprovado com as variáveis do corpo, na ordem.
 *
 * NÃO confere a trava da recuperação (`WHATSAPP_RECUPERACAO_ENVIAR`): quem
 * decide se pode enviar é `lib/recuperacao-servidor.ts`, e é só de lá que
 * esta função pode ser chamada.
 */
export async function enviarModelo(numero: string, modelo: string, variaveis: string[]): Promise<Envio> {
  const id = NUMERO_ID()
  if (!CHAVE() || !id) return { ok: false, erro: 'Kapso não configurada.' }
  const r = await chamar('POST', `${META}/${id}/messages`, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: numero,
    type: 'template',
    template: {
      name: modelo,
      language: { code: IDIOMA },
      components: [{
        type: 'body',
        // A Meta recusa variável com quebra de linha, tabulação ou mais de 4 espaços seguidos.
        parameters: variaveis.map(v => ({ type: 'text', text: v.replace(/\s+/g, ' ').trim().slice(0, 1000) })),
      }],
    },
  }, 30_000)
  if (!r.ok) return { ok: false, erro: r.erro ?? 'Não foi possível enviar.' }
  const primeira = Array.isArray(objeto(r.dados)?.messages) ? objeto((objeto(r.dados)!.messages as unknown[])[0]) : null
  return { ok: true, id: texto(primeira?.id)?.slice(0, 128) ?? null }
}

// --- Webhook (mensagens recebidas) ---------------------------------------

export const CABECALHO_DA_ASSINATURA = 'x-webhook-signature'

/**
 * A senha com que a Kapso assina as entregas, derivada da chave — nada novo
 * para guardar. Trocou a chave, ligue o recebimento de novo pelo painel.
 */
function segredoDoWebhook(): string | null {
  const chave = CHAVE()
  const id = NUMERO_ID()
  return chave && id ? createHmac('sha256', chave).update(`puncaovenosa-recuperacao:${id}`).digest('hex') : null
}

export function assinaturaConfere(corpoCru: string, recebida: string | null): boolean {
  const segredo = segredoDoWebhook()
  if (!segredo || !recebida) return false
  const esperada = createHmac('sha256', segredo).update(corpoCru, 'utf8').digest('hex')
  const a = Buffer.from(recebida.trim().toLowerCase().replace(/^sha256=/, ''))
  const b = Buffer.from(esperada)
  return a.length === b.length && timingSafeEqual(a, b)
}

type WebhookDaKapso = { id: string; url: string; ativo: boolean; segredo: string | null }

async function webhooksDoNumero(url: string): Promise<{ lista: WebhookDaKapso[] } | { erro: string }> {
  const id = NUMERO_ID()
  if (!id) return { erro: 'KAPSO_NUMERO_ID não definida.' }
  const r = await chamar('GET', `${PLATAFORMA}/whatsapp/phone_numbers/${id}/webhooks?kind=kapso&per_page=50&url_contains=${encodeURIComponent(url.split('?')[0])}`)
  if (!r.ok) return { erro: r.erro ?? 'Não foi possível ler os webhooks na Kapso.' }
  const dados = objeto(r.dados)?.data
  const lista = (Array.isArray(dados) ? dados : []).map(objeto).filter((w): w is Record<string, unknown> => w !== null)
    .map(w => ({ id: String(w.id ?? ''), url: String(w.url ?? ''), ativo: w.active !== false, segredo: texto(w.secret_key) }))
  return { lista: lista.filter(w => w.id) }
}

export type SituacaoDoWebhook = 'ligado' | 'desligado' | 'outro_segredo' | 'desconhecido'

export async function situacaoDoWebhook(url: string): Promise<SituacaoDoWebhook> {
  const existentes = await webhooksDoNumero(url)
  if ('erro' in existentes) return 'desconhecido'
  const meu = existentes.lista.find(w => w.url === url)
  if (!meu || !meu.ativo) return 'desligado'
  return meu.segredo === null || meu.segredo === segredoDoWebhook() ? 'ligado' : 'outro_segredo'
}

/**
 * Cria (ou acerta) na Kapso o webhook deste número, só com as mensagens
 * recebidas. Não manda mensagem a ninguém. Não cadastre a URL à mão no painel
 * da Kapso: ela iria sem a senha, e toda entrega seria recusada com 401.
 */
export async function ligarWebhook(url: string): Promise<{ erro: string | null }> {
  const id = NUMERO_ID()
  const segredo = segredoDoWebhook()
  if (!id || !segredo) return { erro: 'Kapso não configurada.' }
  const existentes = await webhooksDoNumero(url)
  if ('erro' in existentes) return { erro: existentes.erro }
  const corpo = { whatsapp_webhook: { kind: 'kapso', url, events: ['whatsapp.message.received'], active: true, secret_key: segredo } }
  const igual = existentes.lista.find(w => w.url === url)
  const r = igual
    ? await chamar('PATCH', `${PLATAFORMA}/whatsapp/phone_numbers/${id}/webhooks/${encodeURIComponent(igual.id)}`, corpo)
    : await chamar('POST', `${PLATAFORMA}/whatsapp/phone_numbers/${id}/webhooks`, corpo)
  return { erro: r.ok ? null : r.erro }
}

/** Uma mensagem recebida, só o que a recuperação usa: quem mandou e o texto. */
export type MensagemRecebida = { numero: string; texto: string }

/**
 * Lê o payload v2 da Kapso (`whatsapp.message.received`, avulso ou em lote).
 * Ignora o que este número mandou e o que veio para outro número. Nunca lança.
 */
export function lerMensagensRecebidas(corpo: unknown, eventoDoCabecalho: string | null): MensagemRecebida[] {
  const c = objeto(corpo) ?? {}
  const evento = String(eventoDoCabecalho ?? c.type ?? c.event ?? '').trim().toLowerCase()
  if (evento !== 'whatsapp.message.received') return []
  const id = NUMERO_ID()
  const itens = c.batch === true && Array.isArray(c.data) ? c.data : [c]
  return itens.flatMap(item => {
    const d = objeto(item)
    const m = objeto(d?.message)
    if (!d || !m) return []
    const conversa = objeto(d.conversation)
    const doNumero = texto(d.phone_number_id) ?? texto(conversa?.phone_number_id)
    if (id && doNumero && doNumero !== id) return []
    if (objeto(m.kapso)?.direction === 'outbound') return []
    const remetente = (texto(m.from) ?? texto(conversa?.phone_number) ?? '').replace(/\D/g, '')
    const interativo = objeto(m.interactive)
    const conteudo = texto(objeto(m.text)?.body)
      ?? texto(objeto(m.button)?.payload) ?? texto(objeto(m.button)?.text)
      ?? texto(objeto(interativo?.button_reply)?.id) ?? texto(objeto(interativo?.list_reply)?.id)
    return remetente && conteudo ? [{ numero: remetente, texto: conteudo.slice(0, 500) }] : []
  })
}
