import { notFound } from 'next/navigation'
import { RedCross } from '@/components/clinical-header'
import { SecretariaMapa, type PontoMapa } from '@/components/secretaria-mapa'
import { coordsDaResposta, resumoDaResposta } from '@/lib/cep'
import { formatarBRL, maskCpf, maskPhone, triageQuestions } from '@/lib/enrollment'
import { metaCapiConfigurado } from '@/lib/meta-capi'
import { CHAVES, PAGINAS, caminhoDaPagina } from '@/lib/paginas-de-venda'
import { audienciaConfigurada, JANELA_DE_ABANDONO_HORAS } from '@/lib/meta-audiencia'
import { secretariaAutenticada, secretariaHabilitada } from '@/lib/secretaria'
import { supabaseServer } from '@/lib/supabase/server'
import { EVENTOS_WEBHOOK, webhookSecretariaConfigurado } from '@/lib/webhook-secretaria'

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

const NOME_DO_EVENTO: Record<string, string> = {
  inscricao_recebida: 'Inscrição recebida',
  pagamento_iniciado: 'Pagamento iniciado',
  pagamento_confirmado: 'Pagamento confirmado',
  pagamento_falhou: 'Pagamento falhou',
  triagem_concluida: 'Triagem concluída',
}

const NOME_DO_EVENTO_META: Record<string, string> = {
  funil_3_dados: 'Lead (dados recebidos)',
  funil_4_pagamento: 'AddPaymentInfo (pagamento iniciado)',
  funil_5_pago: 'Purchase (pagamento confirmado)',
  funil_7_triagem_fim: 'CompleteRegistration (triagem concluída)',
}

const STATUS_DE_FALHA = ['recusado', 'expirado', 'estornado']

const EXEMPLO_PAYLOAD = `{
  "evento": "pagamento_confirmado",
  "disparadoEm": "2026-08-23T14:02:11.000Z",
  "inscricao": {
    "id": "5f2c...",
    "numeroInscricao": "CVB-2026-0031",
    "nome": "Maria da Silva",
    "cpf": "12345678900",
    "telefone": "21999998888",
    "email": "maria@exemplo.com",
    "ensinoMedio": true,
    "status": "paga",
    "criadoEm": "2026-08-23T13:58:02.000Z",
    "atualizadoEm": "2026-08-23T14:02:11.000Z"
  },
  "pagamento": { "status": "confirmado", "metodo": "pix", "valorCentavos": 24900 },
  "triagemRespondida": 0
}`

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

/** Uma linha de `funil_por_origem` — uma variante ou uma campanha. */
type LinhaDeOrigem = {
  chave: string
  visitas: number
  inscricoes: number
  pagas: number
  completas: number
}

/** Percentual só quando o denominador existe: 0 de 0 não é 0%, é nada a dizer. */
const pct = (parte: number, todo: number) => (todo > 0 ? `${Math.round((parte / todo) * 100)}%` : '—')

// A chave gravada no banco é curta (`a`, `b`); quem lê o painel quer o nome.
const ROTULOS_DAS_PAGINAS = Object.fromEntries(
  CHAVES.map(chave => [chave, { nome: PAGINAS[chave].nome, caminho: caminhoDaPagina(chave) }]),
)

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
  searchParams: Promise<{
    erro?: string
    reenviado?: string; erroWebhook?: string
    reenviadoMeta?: string; erroMeta?: string
    sincronizadoAudiencia?: string; falhasAudiencia?: string; removidosAudiencia?: string; erroAudiencia?: string
    audienciaCriada?: string; erroAudienciaCriar?: string
  }>
}) {
  // Deploy que não pediu por este painel não tem este painel.
  if (!secretariaHabilitada()) notFound()

  const params = await searchParams

  if (!(await secretariaAutenticada())) {
    return <Moldura>
      <form className="secretaria-entrada" method="post" action="/secretaria/entrar">
        <h1>Painel da secretaria</h1>
        <p>Acompanhamento das inscrições do Curso de Punção Venosa.</p>
        <label htmlFor="senha">Senha de acesso</label>
        <input id="senha" name="senha" type="password" autoComplete="current-password" required autoFocus />
        {params.erro && <p className="secretaria-erro" role="alert">Senha incorreta.</p>}
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

  // Visitas na landing: o topo real do funil, sem inscrição nenhuma para
  // ancorar — por isso é tabela à parte (migration 0011), não uma coluna em
  // `inscricoes`. O pixel do Meta já conta PageView do lado dele; isto é o
  // que faz essa contagem existir também aqui, e dá pra calcular visita →
  // dados preenchidos, que sem isto era invisível no próprio painel.
  const { count: visitas, error: erroVisitas } = await supabase
    .from('visitas_landing')
    .select('id', { count: 'exact', head: true })
  const taxaDeEntrada = visitas ? Math.round((total / visitas) * 100) : null

  // Funil completo: quem entrou (total) contra quem realmente matriculou
  // (triagem_concluida) — e onde, no meio do caminho, cada um empacou.
  const rascunhos = (inscricoes ?? []).filter(i => i.status === 'rascunho').length
  const aguardando = (inscricoes ?? []).filter(i => i.status === 'aguardando_pagamento').length
  const pagouSoTriagemFalta = (inscricoes ?? []).filter(i => i.status === 'paga').length
  const canceladas = (inscricoes ?? []).filter(i => i.status === 'cancelada').length
  const falhasDePagamento = [...ultimaCobranca.values()].filter(p => STATUS_DE_FALHA.includes(p.status)).length
  const taxaDeMatricula = total ? Math.round((completas / total) * 100) : 0

  // Funil por origem: agregado no banco (migration 0013), e não em memória
  // como o resto desta página, porque `visitas_landing` cresce a cada acesso
  // à landing — carregar tudo aqui para contar seria a primeira coisa a
  // derrubar o painel quando a campanha escalar.
  const [{ data: porVariante, error: erroOrigem }, { data: porCampanha }] = await Promise.all([
    supabase.rpc('funil_por_origem', { p_dimensao: 'variante' }),
    supabase.rpc('funil_por_origem', { p_dimensao: 'utm_campaign' }),
  ])
  // Cast à mão: os tipos gerados do Supabase não conhecem esta função, e
  // `.returns<T[]>()` esbarra na inferência do próprio cliente.
  const linhasPorVariante = (porVariante ?? []) as LinhaDeOrigem[]
  const linhasPorCampanha = (porCampanha ?? []) as LinhaDeOrigem[]

  // Pontos do mapa: só quem tem coordenada gravada na resposta do passo 1 —
  // exata (BrasilAPI) ou aproximada por bairro/cidade (Nominatim, gravada em
  // PUT /api/triagem quando a exata não veio).
  const pontosMapa: PontoMapa[] = (inscricoes ?? []).flatMap(i => {
    const passo1 = triagem.get(i.id)?.get(1)
    const coords = coordsDaResposta(passo1)
    if (!coords) return []
    return [{
      id: i.id,
      latitude: coords.latitude,
      longitude: coords.longitude,
      popup: `${resumoDaResposta(passo1)} · ${SITUACAO[i.status] ?? i.status}`,
      criadoEm: i.criado_em,
    }]
  })

  // Checkpoint do webhook: lido à parte porque a tabela só existe depois da
  // migration 0009 — um banco ainda não atualizado não pode derrubar o resto
  // do painel, só deixar esse bloco de fora.
  const webhookConfigurado = webhookSecretariaConfigurado()
  const { data: entregas, error: erroEntregas } = await supabase
    .from('webhook_entregas')
    .select('id, inscricao_id, evento, sucesso, status_http, erro, criado_em')
    .order('criado_em', { ascending: false })
    .limit(50)

  const nomePorInscricao = new Map((inscricoes ?? []).map(i => [i.id, i.nome]))
  const falhasRecentes = (entregas ?? []).filter(e => !e.sucesso).length

  // Checkpoint do Pixel: mesma lógica, para a Conversions API do Meta.
  const metaConfigurado = metaCapiConfigurado()
  const { data: entregasMeta, error: erroEntregasMeta } = await supabase
    .from('meta_capi_entregas')
    .select('id, inscricao_id, evento, pagamento_id, sucesso, status_http, erro, criado_em')
    .order('criado_em', { ascending: false })
    .limit(50)

  const falhasRecentesMeta = (entregasMeta ?? []).filter(e => !e.sucesso).length

  // Checkpoint do público de remarketing: mesma lógica, para quem está no
  // público personalizado do Meta agora (adicionado e ainda não removido).
  const audienciaConfig = audienciaConfigurada()
  const { count: noPublicoAgora, error: erroPublico } = await supabase
    .from('meta_publico_membros')
    .select('id', { count: 'exact', head: true })
    .is('removido_em', null)
  const { count: jaRemovidos } = await supabase
    .from('meta_publico_membros')
    .select('id', { count: 'exact', head: true })
    .not('removido_em', 'is', null)

  return <Moldura autenticado>
    <div className="secretaria-resumo">
      {!erroVisitas && (
        <div><strong>{visitas ?? 0}</strong><span>visitaram a landing{taxaDeEntrada !== null && ` · ${taxaDeEntrada}% preencheu os dados`}</span></div>
      )}
      <div><strong>{total}</strong><span>entraram no funil</span></div>
      <div><strong>{pagas}</strong><span>pagaram</span></div>
      <div><strong>{completas}</strong><span>matricularam ({taxaDeMatricula}%)</span></div>
    </div>

    {erroVisitas && (
      <p className="secretaria-vazio">
        A contagem de visitas na landing ainda não está disponível — provavelmente a migration <code>0011_visitas_landing</code> não
        foi aplicada neste banco ainda.
      </p>
    )}

    {total > 0 && (
      <section className="secretaria-bloco">
        <h2>Funil completo — quem entrou × quem matriculou</h2>
        <p className="secretaria-bloco-legenda">
          {!erroVisitas && visitas ? `De ${visitas} visitas na landing, ${total} preencheram os dados. ` : ''}
          De {total} que começaram, {completas} concluíram a matrícula. O resto está parado em algum ponto —
          é aqui que dá para ver onde.
        </p>
        <div className="secretaria-quedas">
          <div className="secretaria-queda">
            <strong>{rascunhos}</strong>
            <span>preencheram os dados e não abriram cobrança</span>
          </div>
          <div className="secretaria-queda">
            <strong>{aguardando}</strong>
            <span>abriram cobrança e não pagaram</span>
          </div>
          <div className="secretaria-queda">
            <strong>{pagouSoTriagemFalta}</strong>
            <span>pagaram e não terminaram a triagem</span>
          </div>
          <div className="secretaria-queda ok">
            <strong>{completas}</strong>
            <span>matrícula completa</span>
          </div>
          {canceladas > 0 && (
            <div className="secretaria-queda alerta">
              <strong>{canceladas}</strong>
              <span>canceladas</span>
            </div>
          )}
          {falhasDePagamento > 0 && (
            <div className="secretaria-queda alerta">
              <strong>{falhasDePagamento}</strong>
              <span>cobranças recusadas, expiradas ou estornadas</span>
            </div>
          )}
        </div>
      </section>
    )}

    {!erroOrigem && (
      <section className="secretaria-bloco">
        <h2>O que converte — por página e por campanha</h2>
        <p className="secretaria-bloco-legenda">
          O mesmo funil de cima, quebrado por origem. É o que responde qual página vende e qual anúncio traz
          gente que paga — e não só gente que clica. Cada página tem endereço próprio (a coluna mostra qual):
          quem decide o que a pessoa vê é o link do anúncio, não um sorteio. A atribuição é de{' '}
          <strong>primeiro toque</strong> — quem voltou por um segundo anúncio e concluiu ali continua
          creditado a quem o trouxe da primeira vez. Quem entrou antes de 23/08/2026 aparece em{' '}
          <em>sem registro</em>: a inscrição só passou a guardar origem a partir dessa data.
        </p>
        <FunilPorOrigem titulo="Página de venda" rotuloDaChave="Página" linhas={linhasPorVariante} rotulos={ROTULOS_DAS_PAGINAS} />
        <FunilPorOrigem titulo="Campanha (utm_campaign)" rotuloDaChave="Campanha" linhas={linhasPorCampanha} />
      </section>
    )}

    <section className="secretaria-bloco">
      <h2>De onde vêm as inscrições</h2>
      <p className="secretaria-bloco-legenda">
        Um ponto aproximado por inscrição, na região do CEP ou endereço informado na triagem — não é a rua exata,
        é o suficiente para enxergar de onde o pessoal está vindo. A cor não é status, é tempo: verde forte para
        quem acabou de entrar, esmaecendo para laranja conforme as semanas passam — o mapa vai "preenchendo" e dá
        para ver de longe onde uma região ficou parada.
        {pontosMapa.length > 0 && ` Mostrando ${pontosMapa.length} de ${total} inscrições.`}
      </p>
      <div className="secretaria-mapa-legenda">
        <span>Recém-chegado</span>
        <span className="secretaria-mapa-gradiente" />
        <span>Há {'>'}8 semanas</span>
      </div>
      <SecretariaMapa pontos={pontosMapa} />
    </section>

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

    <section className="secretaria-bloco">
      <h2>Checkpoint do webhook</h2>
      <p className="secretaria-bloco-legenda">
        Cada evento do funil (inscrição recebida, pagamento iniciado, pagamento confirmado, pagamento falhou,
        triagem concluída) é enviado ao sistema da secretaria por aqui. Esta lista é onde uma entrega que falhou
        fica visível — o funil continua andando mesmo se o outro lado estiver fora do ar, mas isto aqui é o
        lugar para perceber que ele esteve.
      </p>

      {params.reenviado && <p className="secretaria-selo ok" role="status">Reenviado.</p>}
      {params.erroWebhook && <p className="secretaria-erro" role="alert">Não foi possível reenviar. Confira o log abaixo.</p>}

      <div className={`secretaria-webhook-status ${webhookConfigurado ? 'ok' : 'espera'}`}>
        {webhookConfigurado
          ? 'Configurado — WEBHOOK_SECRETARIA_URL e WEBHOOK_SECRETARIA_SEGREDO definidas.'
          : 'Não configurado. Sem WEBHOOK_SECRETARIA_URL e WEBHOOK_SECRETARIA_SEGREDO no ambiente, nenhum evento é enviado — o funil segue funcionando normalmente.'}
      </div>

      {erroEntregas ? (
        <p className="secretaria-vazio">
          O log de entregas ainda não está disponível — provavelmente a migration <code>0009_webhook_entregas</code> não
          foi aplicada neste banco ainda.
        </p>
      ) : !entregas || entregas.length === 0 ? (
        <p className="secretaria-vazio">Nenhuma entrega ainda.</p>
      ) : (
        <>
          {falhasRecentes > 0 && (
            <p className="secretaria-erro" role="alert">{falhasRecentes} entrega(s) com falha nas últimas {entregas.length}.</p>
          )}
          <div className="secretaria-tabela-rolagem">
            <table className="secretaria-tabela">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Evento</th>
                  <th>Aluno</th>
                  <th>Resultado</th>
                  <th>Detalhe</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entregas.map(e => (
                  <tr key={e.id}>
                    <td className="secretaria-quando">{dataHora(e.criado_em)}</td>
                    <td>{NOME_DO_EVENTO[e.evento] ?? e.evento}</td>
                    <td>{nomePorInscricao.get(e.inscricao_id) ?? '—'}</td>
                    <td><span className={`secretaria-selo ${e.sucesso ? 'ok' : 'espera'}`}>{e.sucesso ? 'entregue' : 'falhou'}</span></td>
                    <td className="secretaria-sub">{e.status_http ?? '—'}{e.erro ? ` · ${e.erro}` : ''}</td>
                    <td>
                      {!e.sucesso && webhookConfigurado && (
                        <form method="post" action="/secretaria/webhook/reenviar">
                          <input type="hidden" name="inscricaoId" value={e.inscricao_id} />
                          <input type="hidden" name="evento" value={e.evento} />
                          <button className="text-button" type="submit">Reenviar</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <details className="secretaria-contrato">
        <summary>Contrato para o outro sistema plugar (payload, eventos, assinatura)</summary>
        <p>
          Configure <code>WEBHOOK_SECRETARIA_URL</code> (endereço que recebe o POST) e{' '}
          <code>WEBHOOK_SECRETARIA_SEGREDO</code> (usado para assinar) nas variáveis de ambiente do projeto.
          Sem as duas, nada é enviado.
        </p>
        <p>
          Cada evento é um <code>POST</code> com corpo JSON e dois cabeçalhos: <code>X-Cvb-Evento</code> com o
          nome do evento, e <code>X-Cvb-Assinatura</code> com <code>sha256=&lt;hmac-hex&gt;</code>, calculado
          sobre o corpo cru com <code>WEBHOOK_SECRETARIA_SEGREDO</code>. Valide a assinatura antes de processar —
          o corpo por si só não prova que veio daqui.
        </p>
        <p>Eventos possíveis: {EVENTOS_WEBHOOK.map(ev => <code key={ev}>{NOME_DO_EVENTO[ev] ?? ev}</code>)}.</p>
        <pre className="secretaria-payload">{EXEMPLO_PAYLOAD}</pre>
        <p>
          Responda 2xx para marcar como entregue. Qualquer outra coisa fica registrada como falha nesta tela,
          com o motivo, e pode ser reenviada por aqui — sem retentativa automática.
        </p>
      </details>
    </section>

    <section className="secretaria-bloco">
      <h2>Checkpoint do Pixel (Conversions API)</h2>
      <p className="secretaria-bloco-legenda">
        Além do pixel no navegador, o servidor manda uma cópia de cada evento de dinheiro (Lead, AddPaymentInfo,
        Purchase, CompleteRegistration) direto para o Meta — bloqueador de anúncio e Safari costumam derrubar uma
        fatia real do que depende só do navegador, sem ninguém perceber. Esta lista é onde essa cópia falhando
        fica visível.
      </p>

      {params.reenviadoMeta && <p className="secretaria-selo ok" role="status">Reenviado ao Meta.</p>}
      {params.erroMeta && <p className="secretaria-erro" role="alert">Não foi possível reenviar. Confira o log abaixo.</p>}

      <div className={`secretaria-webhook-status ${metaConfigurado ? 'ok' : 'espera'}`}>
        {metaConfigurado
          ? 'Configurado — META_CAPI_TOKEN definida.'
          : 'Não configurado. Sem META_CAPI_TOKEN no ambiente, nenhum evento é enviado ao Meta pelo servidor — o pixel do navegador continua funcionando normalmente sozinho.'}
      </div>

      {erroEntregasMeta ? (
        <p className="secretaria-vazio">
          O log ainda não está disponível — provavelmente a migration <code>0010_meta_capi_entregas</code> não foi
          aplicada neste banco ainda.
        </p>
      ) : !entregasMeta || entregasMeta.length === 0 ? (
        <p className="secretaria-vazio">Nenhum evento enviado ainda.</p>
      ) : (
        <>
          {falhasRecentesMeta > 0 && (
            <p className="secretaria-erro" role="alert">{falhasRecentesMeta} entrega(s) com falha nas últimas {entregasMeta.length}.</p>
          )}
          <div className="secretaria-tabela-rolagem">
            <table className="secretaria-tabela">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Evento</th>
                  <th>Aluno</th>
                  <th>Resultado</th>
                  <th>Detalhe</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entregasMeta.map(e => (
                  <tr key={e.id}>
                    <td className="secretaria-quando">{dataHora(e.criado_em)}</td>
                    <td>{NOME_DO_EVENTO_META[e.evento] ?? e.evento}</td>
                    <td>{nomePorInscricao.get(e.inscricao_id) ?? '—'}</td>
                    <td><span className={`secretaria-selo ${e.sucesso ? 'ok' : 'espera'}`}>{e.sucesso ? 'entregue' : 'falhou'}</span></td>
                    <td className="secretaria-sub">{e.status_http ?? '—'}{e.erro ? ` · ${e.erro}` : ''}</td>
                    <td>
                      {!e.sucesso && metaConfigurado && (
                        <form method="post" action="/secretaria/meta/reenviar">
                          <input type="hidden" name="inscricaoId" value={e.inscricao_id} />
                          <input type="hidden" name="evento" value={e.evento} />
                          {e.pagamento_id && <input type="hidden" name="pagamentoId" value={e.pagamento_id} />}
                          <button className="text-button" type="submit">Reenviar</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <details className="secretaria-contrato">
        <summary>Como conferir e o que isto envia</summary>
        <p>
          Configure <code>META_CAPI_TOKEN</code> (gerado no Gerenciador de Eventos → Configurações → API de
          Conversões → Gerar token de acesso) nas variáveis de ambiente. O <code>DATASET_ID</code> que a API pede é
          o mesmo <code>NEXT_PUBLIC_META_PIXEL_ID</code> já usado pelo pixel.
        </p>
        <p>
          Para ver os eventos aparecendo em tempo real no Meta antes de confiar neles, defina também{' '}
          <code>META_CAPI_TEST_EVENT_CODE</code> (aba "Testar eventos" do Gerenciador de Eventos) — com ela
          definida, os eventos aparecem lá na hora, sem entrar nas métricas de campanha. Remova para valer de
          verdade.
        </p>
        <p>
          Cada evento leva <code>external_id</code> (CPF), <code>ph</code> (telefone), <code>em</code> (e-mail) e{' '}
          <code>fn</code>/<code>ln</code> (nome) com hash SHA-256 — a correspondência avançada do Meta, com dado
          que o navegador nem sempre captura a tempo (ou nunca captura, como o CPF). O <code>event_id</code> é o
          mesmo que o pixel do navegador manda para o mesmo evento, então o Meta deduplica os dois como um só em
          vez de contar a venda duas vezes.
        </p>
      </details>
    </section>

    <section className="secretaria-bloco">
      <h2>Checkpoint do público de remarketing</h2>
      <p className="secretaria-bloco-legenda">
        Quem preencheu nome, telefone e e-mail no funil e não pagou depois de {JANELA_DE_ABANDONO_HORAS}h vai,
        com hash, para um público personalizado no Meta — para anunciar de novo só para quem ficou pelo caminho.
        Sincroniza 1x por dia (limite do plano Hobby da Vercel); a remoção de quem paga é na hora.
      </p>

      {params.sincronizadoAudiencia && (
        <p className="secretaria-selo ok" role="status">
          {params.sincronizadoAudiencia} adicionado(s){params.removidosAudiencia && `, ${params.removidosAudiencia} removido(s)`}.
          {params.falhasAudiencia && ` ${params.falhasAudiencia} falha(s) — confira o log do servidor.`}
        </p>
      )}
      {params.erroAudiencia && <p className="secretaria-erro" role="alert">Não foi possível sincronizar agora.</p>}
      {params.audienciaCriada && (
        <p className="secretaria-selo ok" role="status">
          Público criado — id <code>{params.audienciaCriada}</code>. Salve em <code>META_AUDIENCE_ABANDONADOS_ID</code> na
          Vercel para a sincronização passar a funcionar.
        </p>
      )}
      {params.erroAudienciaCriar && <p className="secretaria-erro" role="alert">Não foi possível criar o público: {params.erroAudienciaCriar}</p>}

      <div className={`secretaria-webhook-status ${audienciaConfig ? 'ok' : 'espera'}`}>
        {audienciaConfig
          ? 'Configurado — META_MARKETING_TOKEN e META_AUDIENCE_ABANDONADOS_ID definidas.'
          : 'Não configurado. Sem META_MARKETING_TOKEN e META_AUDIENCE_ABANDONADOS_ID no ambiente, ninguém é enviado ao público — o resto do funil segue funcionando normalmente.'}
      </div>

      {erroPublico ? (
        <p className="secretaria-vazio">
          A contagem ainda não está disponível — provavelmente a migration <code>0012_meta_publico_membros</code> não
          foi aplicada neste banco ainda.
        </p>
      ) : (
        <div className="secretaria-resumo">
          <div><strong>{noPublicoAgora ?? 0}</strong><span>no público agora</span></div>
          <div><strong>{jaRemovidos ?? 0}</strong><span>removidos por já ter pago</span></div>
        </div>
      )}

      {audienciaConfig && (
        <form method="post" action="/secretaria/meta-audiencia/sincronizar">
          <button className="text-button" type="submit">Sincronizar agora, sem esperar o cron</button>
        </form>
      )}

      <details className="secretaria-contrato">
        <summary>Como configurar</summary>
        <p>
          Gere um token da Marketing API com permissão <code>ads_management</code> (Configurações do Negócio →
          Usuários do sistema) e salve em <code>META_MARKETING_TOKEN</code>. Depois, rode o formulário abaixo uma
          única vez com o ID da conta de anúncios (<code>act_...</code>) para criar o público — o id retornado vai
          em <code>META_AUDIENCE_ABANDONADOS_ID</code>.
        </p>
        {!audienciaConfig && (
          <form method="post" action="/secretaria/meta-audiencia/criar" className="secretaria-entrada-inline">
            <label htmlFor="adAccountId">ID da conta de anúncios</label>
            <input id="adAccountId" name="adAccountId" type="text" placeholder="act_123456789" required />
            <button className="text-button" type="submit">Criar público (rodar uma vez só)</button>
          </form>
        )}
        <p>
          Depois de configurado, o cron diário (<code>vercel.json</code>) chama{' '}
          <code>POST /api/meta-audiencia/sync</code>, protegido por <code>CRON_SECRET</code>. O e-mail e o telefone
          vão com o mesmo hash SHA-256 usado na Conversions API.
        </p>
      </details>
    </section>

    <p className="secretaria-rodape">
      Lista lida do banco no momento em que esta página abriu — atualize para ver o que entrou depois.
      Mostrando as {LIMITE} inscrições mais recentes. Estes são dados pessoais de alunos:
      não compartilhe a tela nem a senha fora da secretaria.
    </p>
  </Moldura>
}

/**
 * Uma quebra do funil por uma dimensão de origem.
 *
 * As duas taxas medem coisas diferentes e as duas importam: "entrou" isola a
 * página (de quem viu, quantos começaram a se inscrever) e "pagou" é o número
 * de dinheiro, ponta a ponta. Uma variante pode ganhar na primeira e perder na
 * segunda — atrair mais gente e vender menos — e só mostrando as duas dá para
 * enxergar isso.
 */
function FunilPorOrigem({ titulo, rotuloDaChave, linhas, rotulos }: {
  titulo: string
  rotuloDaChave: string
  linhas: LinhaDeOrigem[]
  /** Nome legível e endereço de cada chave, quando existirem (caso das páginas). */
  rotulos?: Record<string, { nome: string; caminho: string }>
}) {
  return <div className="secretaria-origem">
    <h3>{titulo}</h3>
    {linhas.length === 0 ? (
      <p className="secretaria-vazio">Nada registrado ainda.</p>
    ) : (
      <div className="secretaria-tabela-rolagem">
        <table className="secretaria-tabela">
          <thead>
            <tr>
              <th>{rotuloDaChave}</th>
              <th>Visitas</th>
              <th>Entrou no funil</th>
              <th>Pagou</th>
              <th>Matriculou</th>
              <th>% entrou</th>
              <th>% pagou</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(l => (
              <tr key={l.chave}>
                <td>
                  <strong>{rotulos?.[l.chave]?.nome ?? l.chave}</strong>
                  {rotulos?.[l.chave] && <span className="secretaria-sub">{rotulos[l.chave].caminho}</span>}
                </td>
                <td>{l.visitas}</td>
                <td>{l.inscricoes}</td>
                <td>{l.pagas}</td>
                <td>{l.completas}</td>
                <td className="secretaria-sub">{pct(l.inscricoes, l.visitas)}</td>
                <td><strong>{pct(l.pagas, l.visitas)}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
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
