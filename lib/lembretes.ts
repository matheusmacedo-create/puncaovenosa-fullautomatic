import { emailConfigurado, enviarLembrete } from '@/lib/email'
import { lembreteDevido, TIPOS_DE_LEMBRETE, type Candidato, type TipoDeLembrete } from '@/lib/lembretes-regras'
import { linkAssinadoConfigurado } from '@/lib/link-assinado'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * Varredura diária dos lembretes de recuperação (GET /api/lembretes/sync,
 * cron da Vercel). Lê o banco, pergunta a `lembreteDevido` quem recebe o
 * quê e envia por `enviarLembrete`, que grava cada tentativa em
 * `email_entregas` — é o mesmo log, e a mesma barreira contra repetição, dos
 * e-mails de transição.
 *
 * Só corre com as três coisas no lugar: e-mail configurado, links
 * assinados (um lembrete que leva a um funil vazio não recupera ninguém) e
 * a migration 0017 aplicada. Sem a migration, a consulta aos tipos novos
 * falha e a varredura para antes de enviar — sem o log desses tipos, ela
 * não saberia quem já recebeu e mandaria o mesmo lembrete todo dia.
 */

/** Teto por rodada: a função tem tempo limitado, e a Resend, limite de envios por segundo. */
const MAXIMO_POR_RODADA = 60
/** Pausa entre envios, abaixo do limite padrão de 2 por segundo da Resend. */
const PAUSA_MS = 600
/** Janela de leitura, com folga sobre as janelas de `lembretes-regras.ts`. */
const DIAS_DE_LEITURA = 16

export type ResultadoDaVarredura =
  | { executada: false; motivo: string }
  | { executada: true; devidos: number; enviados: number; falhas: number; adiados: number; porTipo: Record<TipoDeLembrete, number> }

const esperar = (ms: number) => new Promise(r => setTimeout(r, ms))

export async function varrerLembretes(agora = Date.now()): Promise<ResultadoDaVarredura> {
  if (!emailConfigurado()) return { executada: false, motivo: 'RESEND_API_KEY/EMAIL_REMETENTE ausentes.' }
  if (!linkAssinadoConfigurado()) return { executada: false, motivo: 'LINK_ASSINADO_SEGREDO ausente ou curto (mínimo 32 caracteres).' }

  const supabase = supabaseServer()
  const desde = new Date(agora - DIAS_DE_LEITURA * 86_400_000).toISOString()

  // Leituras por data, não por lista de ids: uma lista de centenas de uuids
  // num `in()` estoura o tamanho de URL que o PostgREST aceita.
  const [inscricoes, pagamentos, respostas, entregas] = await Promise.all([
    supabase
      .from('inscricoes')
      .select('id, status, email, lembretes_desligados_em')
      // `atualizado_em`, não `criado_em`: o CPF é a chave da inscrição, e
      // quem volta semanas depois reaproveita a linha antiga.
      .gte('atualizado_em', desde)
      .not('email', 'is', null),
    supabase
      .from('pagamentos')
      .select('inscricao_id, etapa, status, criado_em, confirmado_em')
      .gte('criado_em', desde)
      .in('etapa', ['matricula', 'integral']),
    supabase
      .from('triagem_respostas')
      .select('inscricao_id')
      .gte('criado_em', desde),
    supabase
      .from('email_entregas')
      .select('inscricao_id, tipo, criado_em')
      .eq('sucesso', true)
      .in('tipo', [...TIPOS_DE_LEMBRETE])
      .gte('criado_em', desde),
  ])

  const erro = inscricoes.error ?? pagamentos.error ?? respostas.error ?? entregas.error
  if (erro) {
    console.error('[lembretes] leitura falhou — migration 0017 aplicada?', erro)
    return { executada: false, motivo: `Leitura falhou: ${erro.message}` }
  }

  const candidatos = new Map<string, Candidato>()
  for (const i of inscricoes.data ?? []) {
    candidatos.set(i.id, {
      status: i.status,
      email: i.email,
      lembretesDesligados: i.lembretes_desligados_em !== null,
      primeiraCobrancaEm: null,
      matriculaPagaEm: null,
      passosRespondidos: 0,
      enviados: {},
    })
  }

  for (const p of pagamentos.data ?? []) {
    const c = candidatos.get(p.inscricao_id)
    if (!c) continue
    const criado = Date.parse(p.criado_em)
    if (c.primeiraCobrancaEm === null || criado < c.primeiraCobrancaEm) c.primeiraCobrancaEm = criado
    if (p.status === 'confirmado' && p.confirmado_em) {
      const pago = Date.parse(p.confirmado_em)
      if (c.matriculaPagaEm === null || pago < c.matriculaPagaEm) c.matriculaPagaEm = pago
    }
  }

  for (const r of respostas.data ?? []) {
    const c = candidatos.get(r.inscricao_id)
    if (c) c.passosRespondidos += 1
  }

  for (const e of entregas.data ?? []) {
    const c = candidatos.get(e.inscricao_id)
    if (c) c.enviados[e.tipo as TipoDeLembrete] = Date.parse(e.criado_em)
  }

  const devidos: [string, TipoDeLembrete][] = []
  for (const [id, c] of candidatos) {
    const tipo = lembreteDevido(c, agora)
    if (tipo) devidos.push([id, tipo])
  }

  const porTipo = Object.fromEntries(TIPOS_DE_LEMBRETE.map(t => [t, 0])) as Record<TipoDeLembrete, number>
  let enviados = 0
  let falhas = 0
  // O que passar do teto fica para a rodada de amanhã: as regras continuam
  // devendo o lembrete, e a janela de cada um é de dias, não de horas.
  const daRodada = devidos.slice(0, MAXIMO_POR_RODADA)
  for (const [n, [id, tipo]] of daRodada.entries()) {
    if (n > 0) await esperar(PAUSA_MS)
    if (await enviarLembrete(id, tipo)) { enviados += 1; porTipo[tipo] += 1 } else falhas += 1
  }

  console.log(`[lembretes] devidos ${devidos.length} · enviados ${enviados} · falhas ${falhas} · adiados ${devidos.length - daRodada.length}`)
  return { executada: true, devidos: devidos.length, enviados, falhas, adiados: devidos.length - daRodada.length, porTipo }
}
