import { notFound } from 'next/navigation'
import { RedCross } from '@/components/clinical-header'
import { resumoDaResposta } from '@/lib/cep'
import { formatarBRL, maskCpf, maskPhone, triageQuestions } from '@/lib/enrollment'
import { secretariaAutenticada, secretariaHabilitada } from '@/lib/secretaria'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * Painel da secretaria: o que está passando pelo funil, ao vivo.
 *
 * É uma janela de leitura provisória, até a integração com os sistemas da
 * secretaria existir. Lê direto do banco, que já é a fonte da verdade — não há
 * cópia para sincronizar nem exportação para agendar.
 *
 * Renderiza no servidor a cada acesso: a lista muda a cada inscrição e a cada
 * pagamento confirmado, e uma tela de acompanhamento em cache seria enganosa.
 */
export const dynamic = 'force-dynamic'

const LIMITE = 300

const SITUACAO: Record<string, string> = {
  rascunho: 'Cadastro incompleto',
  aguardando_pagamento: 'Aguardando pagamento',
  paga: 'Pago',
  triagem_concluida: 'Inscrição completa',
  cancelada: 'Cancelada',
}

// Os passos que decidem a turma. Os outros (e-mail, confirmações finais) não
// ajudam a montar calendário, então ficam de fora para a tabela caber na tela.
const PASSOS_UTEIS = [
  { passo: 1, rotulo: 'CEP / região' },
  { passo: 2, rotulo: 'Perfil' },
  { passo: 3, rotulo: 'Turno' },
  { passo: 4, rotulo: 'Dias' },
  { passo: 5, rotulo: 'Quando' },
  { passo: 7, rotulo: 'Origem' },
] as const

type Inscricao = {
  id: string
  nome: string
  cpf: string
  telefone: string
  email: string | null
  numero_inscricao: string | null
  status: string
  criado_em: string
}

const dataHora = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })
    .format(new Date(iso))

/**
 * As respostas são jsonb e variam de forma por passo: texto, escolha, lista —
 * e, no passo do CEP, um objeto com o endereço resolvido.
 */
function respostaLegivel(passo: number, valor: unknown): string {
  if (valor == null) return '—'
  if (passo === 1) return resumoDaResposta(valor)
  if (Array.isArray(valor)) {
    if (valor.every(v => typeof v === 'boolean')) return valor.every(Boolean) ? 'sim' : 'não'
    return valor.join(', ')
  }
  return String(valor)
}

export default async function SecretariaPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  // Deploy que não pediu por este painel não tem este painel.
  if (!secretariaHabilitada()) notFound()

  if (!(await secretariaAutenticada())) {
    const { erro } = await searchParams
    return <Moldura>
      <form className="secretaria-entrada" method="post" action="/secretaria/entrar">
        <h1>Painel da secretaria</h1>
        <p>Acompanhamento das inscrições do Curso de Punção Venosa.</p>
        <label htmlFor="senha">Senha de acesso</label>
        <input id="senha" name="senha" type="password" autoComplete="current-password" required autoFocus />
        {erro && <p className="secretaria-erro" role="alert">Senha incorreta.</p>}
        <button className="primary-button full" type="submit">Entrar</button>
      </form>
    </Moldura>
  }

  const supabase = supabaseServer()

  const { data: inscricoes, error } = await supabase
    .from('inscricoes')
    .select('id, nome, cpf, telefone, email, numero_inscricao, status, criado_em')
    .order('criado_em', { ascending: false })
    .limit(LIMITE)
    .returns<Inscricao[]>()

  if (error) {
    console.error('[secretaria] leitura falhou:', error)
    return <Moldura><p className="secretaria-erro">Não foi possível ler as inscrições agora.</p></Moldura>
  }

  const ids = (inscricoes ?? []).map(i => i.id)

  // Duas leituras a mais e a junção em memória: são poucas linhas, e assim
  // cada consulta continua sendo simples de ler.
  const [{ data: pagamentos }, { data: respostas }] = await Promise.all([
    ids.length
      ? supabase.from('pagamentos')
          .select('inscricao_id, status, metodo, valor_centavos, criado_em')
          .in('inscricao_id', ids)
          .order('criado_em', { ascending: false })
      : Promise.resolve({ data: [] as never[] }),
    ids.length
      ? supabase.from('triagem_respostas')
          .select('inscricao_id, passo, resposta')
          .in('inscricao_id', ids)
      : Promise.resolve({ data: [] as never[] }),
  ])

  // A cobrança que vale é a mais recente — a lista já vem ordenada, então a
  // primeira de cada inscrição é a certa.
  const ultimaCobranca = new Map<string, { status: string; metodo: string | null; valor_centavos: number }>()
  for (const p of pagamentos ?? []) if (!ultimaCobranca.has(p.inscricao_id)) ultimaCobranca.set(p.inscricao_id, p)

  const triagem = new Map<string, Map<number, unknown>>()
  for (const r of respostas ?? []) {
    if (!triagem.has(r.inscricao_id)) triagem.set(r.inscricao_id, new Map())
    triagem.get(r.inscricao_id)!.set(r.passo, r.resposta)
  }

  const total = inscricoes?.length ?? 0
  const pagas = (inscricoes ?? []).filter(i => i.status === 'paga' || i.status === 'triagem_concluida').length
  const completas = (inscricoes ?? []).filter(i => i.status === 'triagem_concluida').length

  return <Moldura autenticado>
    <div className="secretaria-resumo">
      <div><strong>{total}</strong><span>no funil</span></div>
      <div><strong>{pagas}</strong><span>pagaram</span></div>
      <div><strong>{completas}</strong><span>triagem completa</span></div>
    </div>

    {total === 0 ? (
      <p className="secretaria-vazio">Nenhuma inscrição ainda. Assim que alguém preencher a primeira etapa, ela aparece aqui.</p>
    ) : (
      <div className="secretaria-tabela-rolagem">
        <table className="secretaria-tabela">
          <thead>
            <tr>
              <th>Quando</th>
              <th>Aluno</th>
              <th>Contato</th>
              <th>Situação</th>
              <th>Pagamento</th>
              {PASSOS_UTEIS.map(p => <th key={p.passo}>{p.rotulo}</th>)}
            </tr>
          </thead>
          <tbody>
            {(inscricoes ?? []).map(i => {
              const cobranca = ultimaCobranca.get(i.id)
              const respostasDaPessoa = triagem.get(i.id)
              const paga = i.status === 'paga' || i.status === 'triagem_concluida'
              return <tr key={i.id} className={paga ? 'paga' : undefined}>
                <td className="secretaria-quando">{dataHora(i.criado_em)}</td>
                <td>
                  <strong>{i.nome}</strong>
                  <span className="secretaria-sub">{i.numero_inscricao ?? 'sem número'} · {maskCpf(i.cpf)}</span>
                </td>
                <td>
                  {maskPhone(i.telefone)}
                  <span className="secretaria-sub">{i.email ?? '—'}</span>
                </td>
                <td><span className={`secretaria-selo ${paga ? 'ok' : 'espera'}`}>{SITUACAO[i.status] ?? i.status}</span></td>
                <td>
                  {cobranca ? <>
                    {cobranca.status}
                    <span className="secretaria-sub">{cobranca.metodo} · {formatarBRL(cobranca.valor_centavos)}</span>
                  </> : <span className="secretaria-sub">sem cobrança</span>}
                </td>
                {PASSOS_UTEIS.map(p => (
                  <td key={p.passo} className="secretaria-triagem" title={triageQuestions[p.passo - 1]?.title}>
                    {respostasDaPessoa?.has(p.passo) ? respostaLegivel(p.passo, respostasDaPessoa.get(p.passo)) : '—'}
                  </td>
                ))}
              </tr>
            })}
          </tbody>
        </table>
      </div>
    )}

    <p className="secretaria-rodape">
      Lista lida do banco no momento em que esta página abriu — atualize para ver o que entrou depois.
      Mostrando as {LIMITE} inscrições mais recentes. Estes são dados pessoais de alunos:
      não compartilhe a tela nem a senha fora da secretaria.
    </p>
  </Moldura>
}

function Moldura({ children, autenticado }: { children: React.ReactNode; autenticado?: boolean }) {
  return <main className="secretaria-page">
    <header>
      <RedCross />
      <span>Cruz Vermelha Brasileira · RJ — Punção Venosa</span>
      {autenticado && (
        <form method="post" action="/secretaria/entrar">
          <button className="text-button" type="submit" name="sair" value="1">Sair</button>
        </form>
      )}
    </header>
    {children}
  </main>
}
