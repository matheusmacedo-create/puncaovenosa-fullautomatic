import { emailConfigurado, enviarLembrete } from '@/lib/email'
import { dentroDoHorario, lembreteDevido, TIPOS_DE_LEMBRETE, type Candidato, type TipoDeLembrete } from '@/lib/lembretes-regras'
import { linkAssinadoConfigurado } from '@/lib/link-assinado'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * Varredura dos lembretes de recuperação (GET /api/lembretes/sync), em 8
 * rodadas por dia pelo pg_cron do Supabase (migration 0018).
 * Rodar mais vezes não manda mais e-mails por pessoa — cada lembrete continua
 * saindo uma vez só —, faz cada um chegar mais perto do momento certo. Lê o banco, pergunta a `lembreteDevido` quem recebe o
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
/**
 * Tentativas que falharam antes de desistir de um lembrete. Endereço que a
 * Resend recusa (inválido, em lista de supressão) recusaria para sempre, e
 * ocuparia o teto da rodada à frente de quem ainda pode receber.
 */
const MAXIMO_DE_FALHAS = 3
/** Linhas por página: o PostgREST corta cada resposta em 1000, calado. */
const PAGINA = 1000

export type ResultadoDaVarredura =
  | { executada: false; motivo: string }
  | { executada: true; devidos: number; enviados: number; falhas: number; dispensados: number; desistidos: number; adiados: number; porTipo: Record<TipoDeLembrete, number> }

const esperar = (ms: number) => new Promise(r => setTimeout(r, ms))

type Consulta<T> = (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>

/**
 * Lê a consulta inteira, página por página. Sem isso, a partir de 1000
 * linhas o PostgREST devolve um pedaço qualquer da tabela sem avisar — e
 * uma cobrança confirmada que ficasse de fora do pedaço viraria um "sua
 * matrícula ficou no pagamento" para quem já pagou. A consulta precisa vir
 * com ordem estável (`order('id')`), senão as páginas se sobrepõem.
 */
async function lerTudo<T>(consulta: Consulta<T>): Promise<{ data: T[]; error: { message: string } | null }> {
  const linhas: T[] = []
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await consulta(de, de + PAGINA - 1)
    if (error) return { data: [], error }
    linhas.push(...(data ?? []))
    if (!data || data.length < PAGINA) return { data: linhas, error: null }
  }
}

type LinhaInscricao = { id: string; status: string; email: string | null; lembretes_desligados_em: string | null }
type LinhaPagamento = { inscricao_id: string; etapa: string; status: string; criado_em: string; confirmado_em: string | null }
type LinhaEntrega = { inscricao_id: string; tipo: string; sucesso: boolean; criado_em: string }

function novoCandidato(i: LinhaInscricao): Candidato {
  return {
    status: i.status,
    email: i.email,
    lembretesDesligados: i.lembretes_desligados_em !== null,
    primeiraCobrancaEm: null,
    matriculaPagaEm: null,
    passosRespondidos: 0,
    enviados: {},
  }
}

function somarPagamento(c: Candidato, p: LinhaPagamento) {
  const criado = Date.parse(p.criado_em)
  if (c.primeiraCobrancaEm === null || criado < c.primeiraCobrancaEm) c.primeiraCobrancaEm = criado
  if (p.status === 'confirmado' && p.confirmado_em) {
    const pago = Date.parse(p.confirmado_em)
    if (c.matriculaPagaEm === null || pago < c.matriculaPagaEm) c.matriculaPagaEm = pago
  }
}

function somarEnvio(c: Candidato, e: LinhaEntrega) {
  if (e.sucesso) c.enviados[e.tipo as TipoDeLembrete] = Date.parse(e.criado_em)
}

/**
 * Relê uma inscrição só, logo antes de enviar, e diz se o lembrete ainda é
 * devido. Entre a leitura do começo da rodada e este envio passam minutos
 * (60 e-mails com pausa entre eles): quem pagou, respondeu a triagem ou
 * pediu para parar nesse meio-tempo não pode receber o lembrete. Sem filtro
 * de data aqui, de propósito — é a história inteira daquela pessoa.
 */
async function aindaDevido(inscricaoId: string, tipo: TipoDeLembrete) {
  const supabase = supabaseServer()
  const [inscricao, pagamentos, respostas, entregas] = await Promise.all([
    supabase.from('inscricoes').select('id, status, email, lembretes_desligados_em').eq('id', inscricaoId).maybeSingle(),
    supabase.from('pagamentos').select('inscricao_id, etapa, status, criado_em, confirmado_em').eq('inscricao_id', inscricaoId).in('etapa', ['matricula', 'integral']),
    supabase.from('triagem_respostas').select('id', { count: 'exact', head: true }).eq('inscricao_id', inscricaoId),
    supabase.from('email_entregas').select('inscricao_id, tipo, sucesso, criado_em').eq('inscricao_id', inscricaoId).eq('sucesso', true).in('tipo', [...TIPOS_DE_LEMBRETE]),
  ])
  // Na dúvida, não envia: um lembrete a menos é melhor que um errado.
  if (inscricao.error || pagamentos.error || respostas.error || entregas.error || !inscricao.data) return false

  const c = novoCandidato(inscricao.data as LinhaInscricao)
  for (const p of (pagamentos.data ?? []) as LinhaPagamento[]) somarPagamento(c, p)
  c.passosRespondidos = respostas.count ?? 0
  for (const e of (entregas.data ?? []) as LinhaEntrega[]) somarEnvio(c, e)
  return lembreteDevido(c, Date.now()) === tipo
}

export async function varrerLembretes(agora = Date.now()): Promise<ResultadoDaVarredura> {
  if (!emailConfigurado()) return { executada: false, motivo: 'RESEND_API_KEY/EMAIL_REMETENTE ausentes.' }
  if (!linkAssinadoConfigurado()) return { executada: false, motivo: 'Sem chave para assinar os links (LINK_ASSINADO_SEGREDO ou SUPABASE_SECRET_KEY).' }
  if (!dentroDoHorario(agora)) return { executada: false, motivo: 'Fora do horário de envio (7h às 22h de Brasília).' }

  const supabase = supabaseServer()
  const desde = new Date(agora - DIAS_DE_LEITURA * 86_400_000).toISOString()

  // Leituras por data, não por lista de ids: uma lista de centenas de uuids
  // num `in()` estoura o tamanho de URL que o PostgREST aceita.
  const [inscricoes, pagamentos, respostas, entregas] = await Promise.all([
    lerTudo<LinhaInscricao>((de, ate) => supabase
      .from('inscricoes')
      .select('id, status, email, lembretes_desligados_em')
      // `atualizado_em`, não `criado_em`: o CPF é a chave da inscrição, e
      // quem volta semanas depois reaproveita a linha antiga.
      .gte('atualizado_em', desde)
      .not('email', 'is', null)
      .order('id')
      .range(de, ate)),
    lerTudo<LinhaPagamento>((de, ate) => supabase
      .from('pagamentos')
      .select('id, inscricao_id, etapa, status, criado_em, confirmado_em')
      .gte('criado_em', desde)
      .in('etapa', ['matricula', 'integral'])
      .order('id')
      .range(de, ate)),
    lerTudo<{ inscricao_id: string }>((de, ate) => supabase
      .from('triagem_respostas')
      .select('id, inscricao_id')
      .gte('criado_em', desde)
      .order('id')
      .range(de, ate)),
    // Sem filtro de data: um lembrete enviado há mais de 16 dias continua
    // enviado, e sem enxergá-lo a regra o daria por devido de novo.
    lerTudo<LinhaEntrega>((de, ate) => supabase
      .from('email_entregas')
      .select('id, inscricao_id, tipo, sucesso, criado_em')
      .in('tipo', [...TIPOS_DE_LEMBRETE])
      .order('id')
      .range(de, ate)),
  ])

  const erro = inscricoes.error ?? pagamentos.error ?? respostas.error ?? entregas.error
  if (erro) {
    console.error('[lembretes] leitura falhou — migration 0017 aplicada?', erro)
    return { executada: false, motivo: `Leitura falhou: ${erro.message}` }
  }

  const candidatos = new Map<string, Candidato>()
  for (const i of inscricoes.data) candidatos.set(i.id, novoCandidato(i))

  for (const p of pagamentos.data) {
    const c = candidatos.get(p.inscricao_id)
    if (c) somarPagamento(c, p)
  }

  for (const r of respostas.data) {
    const c = candidatos.get(r.inscricao_id)
    if (c) c.passosRespondidos += 1
  }

  const falhasPorLembrete = new Map<string, number>()
  for (const e of entregas.data) {
    const c = candidatos.get(e.inscricao_id)
    if (c) somarEnvio(c, e)
    if (!e.sucesso) {
      const chave = `${e.inscricao_id}/${e.tipo}`
      falhasPorLembrete.set(chave, (falhasPorLembrete.get(chave) ?? 0) + 1)
    }
  }

  let desistidos = 0
  const devidos: { id: string; tipo: TipoDeLembrete; falhas: number }[] = []
  for (const [id, c] of candidatos) {
    const tipo = lembreteDevido(c, agora)
    if (!tipo) continue
    const falhas = falhasPorLembrete.get(`${id}/${tipo}`) ?? 0
    if (falhas >= MAXIMO_DE_FALHAS) { desistidos += 1; continue }
    devidos.push({ id, tipo, falhas })
  }
  // Quem nunca foi tentado vai na frente de quem já falhou.
  devidos.sort((a, b) => a.falhas - b.falhas)

  const porTipo = Object.fromEntries(TIPOS_DE_LEMBRETE.map(t => [t, 0])) as Record<TipoDeLembrete, number>
  let enviados = 0
  let falhas = 0
  let dispensados = 0
  // O que passar do teto fica para a próxima rodada: as regras continuam
  // devendo o lembrete, e a janela de cada um é de dias, não de horas.
  const daRodada = devidos.slice(0, MAXIMO_POR_RODADA)
  for (const [n, { id, tipo }] of daRodada.entries()) {
    if (!(await aindaDevido(id, tipo))) { dispensados += 1; continue }
    if (n > 0) await esperar(PAUSA_MS)
    if (await enviarLembrete(id, tipo)) { enviados += 1; porTipo[tipo] += 1 } else falhas += 1
  }

  const adiados = devidos.length - daRodada.length
  console.log(`[lembretes] devidos ${devidos.length} · enviados ${enviados} · falhas ${falhas} · dispensados ${dispensados} · desistidos ${desistidos} · adiados ${adiados}`)
  return { executada: true, devidos: devidos.length, enviados, falhas, dispensados, desistidos, adiados, porTipo }
}
