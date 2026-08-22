import { after } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * Espelha cada inscrição numa planilha do Google.
 *
 * É uma ponte provisória: existe para a secretaria enxergar o que o funil
 * coleta antes de haver integração de verdade com os sistemas dela. Some
 * sozinha quando as variáveis saírem do ambiente.
 *
 * A gravação é sempre do servidor. O CPF não pode transitar pelo navegador
 * rumo a um terceiro, e o token da planilha não pode existir no bundle — por
 * isso nenhuma das duas variáveis é `NEXT_PUBLIC_`.
 */

const URL_PLANILHA = () => process.env.PLANILHA_URL?.trim()
const TOKEN_PLANILHA = () => process.env.PLANILHA_TOKEN?.trim()

/** Sem as duas variáveis, o espelhamento simplesmente não existe. */
export function planilhaConfigurada() {
  return Boolean(URL_PLANILHA() && TOKEN_PLANILHA())
}

type Linha = {
  token: string
  inscricaoId: string
  numeroInscricao: string | null
  nome: string
  cpf: string
  telefone: string
  email: string | null
  ensinoMedio: boolean
  statusInscricao: string
  statusPagamento: string
  metodo: string | null
  valorCentavos: number | null
  criadoEm: string
  atualizadoEm: string
  triagemRespondida: number
}

/**
 * Monta a linha lendo o estado atual do banco, em vez de recebê-lo pronto de
 * quem chamou. Assim o que vai para a planilha é sempre o que está gravado, e
 * quem chama só precisa dizer qual inscrição mudou.
 */
async function montarLinha(inscricaoId: string): Promise<Linha | null> {
  const supabase = supabaseServer()

  const { data: inscricao, error } = await supabase
    .from('inscricoes')
    .select('id, cpf, nome, telefone, email, ensino_medio_completo, numero_inscricao, status, criado_em, atualizado_em')
    .eq('id', inscricaoId)
    .maybeSingle()

  if (error || !inscricao) {
    console.error('[planilha] inscrição não encontrada:', inscricaoId, error)
    return null
  }

  // A cobrança que vale é a mais recente: é ela que a tela está mostrando.
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
    token: TOKEN_PLANILHA()!,
    inscricaoId: inscricao.id,
    numeroInscricao: inscricao.numero_inscricao,
    nome: inscricao.nome,
    cpf: inscricao.cpf,
    telefone: inscricao.telefone,
    email: inscricao.email,
    ensinoMedio: inscricao.ensino_medio_completo,
    statusInscricao: inscricao.status,
    statusPagamento: pagamento?.status ?? 'sem cobrança',
    metodo: pagamento?.metodo ?? null,
    valorCentavos: pagamento?.valor_centavos ?? null,
    criadoEm: inscricao.criado_em,
    atualizadoEm: inscricao.atualizado_em,
    triagemRespondida: count ?? 0,
  }
}

/**
 * Envia a linha. Nunca lança: uma planilha fora do ar não pode derrubar uma
 * inscrição nem uma confirmação de pagamento — o banco continua sendo a fonte
 * da verdade, e a planilha é só uma cópia para leitura humana.
 */
async function enviar(inscricaoId: string) {
  try {
    const linha = await montarLinha(inscricaoId)
    if (!linha) return

    const resposta = await fetch(URL_PLANILHA()!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(linha),
      signal: AbortSignal.timeout(10_000),
    })

    if (!resposta.ok) {
      console.error('[planilha] recusou a linha:', resposta.status, await resposta.text().catch(() => ''))
    }
  } catch (e) {
    console.error('[planilha] falhou ao enviar:', e)
  }
}

/**
 * Agenda o espelhamento para depois da resposta.
 *
 * O aluno não espera o Google: a chamada acontece com `after`, então a tela
 * dele já recebeu a resposta quando a linha sobe. Sem isso, um Apps Script
 * lento entraria no tempo de criar a inscrição e de confirmar o pagamento.
 */
export function espelharNaPlanilha(inscricaoId: string) {
  if (!planilhaConfigurada()) return
  after(() => enviar(inscricaoId))
}
