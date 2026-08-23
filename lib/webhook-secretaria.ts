import { createHmac } from 'node:crypto'
import { after } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * Webhook de eventos do funil, para o sistema principal da secretaria consumir.
 *
 * É a integração de verdade — diferente de `lib/planilha.ts`, que é uma ponte
 * provisória para leitura humana. Cada chamada aqui é um evento de negócio
 * (inscrição recebida, pagamento confirmado, ...), não uma cópia de linha.
 *
 * Nunca lança: um sistema de terceiro fora do ar não pode derrubar o funil.
 * Toda tentativa — sucesso ou falha — fica registrada em `webhook_entregas`,
 * e é esse registro que o bloco de checkpoint em /secretaria lê para mostrar
 * o que não chegou lá.
 */

export const EVENTOS_WEBHOOK = [
  'inscricao_recebida',
  'pagamento_iniciado',
  'pagamento_confirmado',
  'pagamento_falhou',
  'triagem_concluida',
] as const

export type EventoWebhook = (typeof EVENTOS_WEBHOOK)[number]

const URL_WEBHOOK = () => process.env.WEBHOOK_SECRETARIA_URL?.trim()
const SEGREDO_WEBHOOK = () => process.env.WEBHOOK_SECRETARIA_SEGREDO?.trim()

/** Sem as duas variáveis, o webhook simplesmente não dispara — igual à planilha. */
export function webhookSecretariaConfigurado() {
  return Boolean(URL_WEBHOOK() && SEGREDO_WEBHOOK())
}

export type PayloadWebhook = {
  evento: EventoWebhook
  disparadoEm: string
  inscricao: {
    id: string
    numeroInscricao: string | null
    nome: string
    cpf: string
    telefone: string
    email: string | null
    ensinoMedio: boolean
    status: string
    criadoEm: string
    atualizadoEm: string
  }
  pagamento: { status: string; metodo: string | null; valorCentavos: number | null } | null
  triagemRespondida: number
}

/**
 * Monta o payload lendo o estado atual do banco, nunca recebendo pronto de
 * quem chamou — o mesmo padrão de `montarLinha` em `lib/planilha.ts`. Assim
 * o que sai pelo webhook é sempre o que está gravado, mesmo num reenvio
 * manual disparado bem depois do evento original.
 */
async function montarPayload(inscricaoId: string, evento: EventoWebhook): Promise<PayloadWebhook | null> {
  const supabase = supabaseServer()

  const { data: inscricao, error } = await supabase
    .from('inscricoes')
    .select('id, cpf, nome, telefone, email, ensino_medio_completo, numero_inscricao, status, criado_em, atualizado_em')
    .eq('id', inscricaoId)
    .maybeSingle()

  if (error || !inscricao) {
    console.error('[webhook-secretaria] inscrição não encontrada:', inscricaoId, error)
    return null
  }

  const { data: pagamento } = await supabase
    .from('pagamentos')
    .select('status, metodo, valor_centavos')
    .eq('inscricao_id', inscricaoId)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { count } = await supabase
    .from('triagem_respostas')
    .select('id', { count: 'exact', head: true })
    .eq('inscricao_id', inscricaoId)

  return {
    evento,
    disparadoEm: new Date().toISOString(),
    inscricao: {
      id: inscricao.id,
      numeroInscricao: inscricao.numero_inscricao,
      nome: inscricao.nome,
      cpf: inscricao.cpf,
      telefone: inscricao.telefone,
      email: inscricao.email,
      ensinoMedio: inscricao.ensino_medio_completo,
      status: inscricao.status,
      criadoEm: inscricao.criado_em,
      atualizadoEm: inscricao.atualizado_em,
    },
    pagamento: pagamento
      ? { status: pagamento.status, metodo: pagamento.metodo, valorCentavos: pagamento.valor_centavos }
      : null,
    triagemRespondida: count ?? 0,
  }
}

/**
 * Assina o corpo com HMAC-SHA256. A Únicopag não assina o próprio postback —
 * foi por isso que o funil precisou aprender a nunca confiar nele e
 * reconsultar a API. Aqui é diferente: o formato é nosso, então o outro
 * programador pode validar a origem antes de processar qualquer evento.
 */
function assinar(corpo: string) {
  return 'sha256=' + createHmac('sha256', SEGREDO_WEBHOOK()!).update(corpo).digest('hex')
}

async function registrar(
  inscricaoId: string,
  evento: EventoWebhook,
  payload: PayloadWebhook,
  sucesso: boolean,
  statusHttp: number | null,
  erro: string | null,
) {
  const { error } = await supabaseServer().from('webhook_entregas').insert({
    inscricao_id: inscricaoId,
    evento,
    payload,
    sucesso,
    status_http: statusHttp,
    erro,
  })
  if (error) console.error('[webhook-secretaria] falha ao registrar entrega:', error)
}

async function enviar(inscricaoId: string, evento: EventoWebhook) {
  const payload = await montarPayload(inscricaoId, evento)
  if (!payload) return

  const corpo = JSON.stringify(payload)

  try {
    const resposta = await fetch(URL_WEBHOOK()!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cvb-Evento': evento,
        'X-Cvb-Assinatura': assinar(corpo),
      },
      body: corpo,
      signal: AbortSignal.timeout(10_000),
    })

    if (resposta.ok) {
      await registrar(inscricaoId, evento, payload, true, resposta.status, null)
    } else {
      const texto = await resposta.text().catch(() => '')
      console.error('[webhook-secretaria] recusado:', resposta.status, texto)
      await registrar(inscricaoId, evento, payload, false, resposta.status, texto.slice(0, 500) || null)
    }
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : 'falha desconhecida'
    console.error('[webhook-secretaria] falhou ao enviar:', e)
    await registrar(inscricaoId, evento, payload, false, null, mensagem)
  }
}

/**
 * Agenda o envio para depois da resposta ao aluno — ele não espera o sistema
 * da secretaria responder. Sem `WEBHOOK_SECRETARIA_URL`/`_SEGREDO`, é um no-op.
 */
export function notificarSecretaria(inscricaoId: string, evento: EventoWebhook) {
  if (!webhookSecretariaConfigurado()) return
  after(() => enviar(inscricaoId, evento))
}

/**
 * Reenvio manual, disparado da tela /secretaria para uma entrega que falhou.
 * Roda na hora, e não depois da resposta: quem clicou em "reenviar" quer ver
 * o resultado, não confiar que aconteceu em algum lugar.
 */
export async function reenviarParaSecretaria(inscricaoId: string, evento: EventoWebhook) {
  if (!webhookSecretariaConfigurado()) throw new Error('Webhook da secretaria não está configurado.')
  await enviar(inscricaoId, evento)
}
