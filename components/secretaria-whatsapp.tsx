import { modeloDaEtapa, situacaoDoNumero, situacaoDoWebhook, variavelDoModelo, kapsoConfigurado } from '@/lib/kapso'
import {
  ETAPAS_DE_RECUPERACAO, HORARIO_PERMITIDO, JANELAS, MOTIVOS, ROTULOS, TEXTOS_SUGERIDOS,
} from '@/lib/recuperacao'
import { envioLigado, MAXIMO_POR_RODADA, montarFila } from '@/lib/recuperacao-servidor'
import { siteUrl } from '@/lib/site-url'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * Aba WhatsApp de /secretaria: o número da escola na Kapso e a recuperação
 * de alunos.
 *
 * Componente de servidor, sem 'use client': lê a Kapso e o banco no momento
 * em que a página abre, como o resto do painel. Nada aqui envia mensagem —
 * os únicos botões ligam o recebimento (cria o webhook na Kapso) e tiram uma
 * pessoa da recuperação.
 *
 * A fila é calculada na hora, com as mesmas regras da rotina diária: é a
 * prévia de quem receberia o quê se a trava estivesse aberta agora.
 */

const HORA = 60 * 60 * 1000
const janela = (ms: number) => (ms >= 24 * HORA ? `${ms / (24 * HORA)} dia(s)` : `${ms / HORA}h`)

const dataHora = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })
    .format(new Date(iso))

const ESTADO_DO_NUMERO: Record<string, string> = {
  conectado: 'Conectado',
  conectando: 'Conectando',
  desconectado: 'Desconectado',
  erro: 'Com problema',
}

export async function SecretariaWhatsapp({ mensagem }: { mensagem: { ok?: string; erro?: string } }) {
  const base = siteUrl()
  const urlDoWebhook = base ? `${base}/api/webhooks/kapso` : null
  const ligado = envioLigado()

  const [numero, webhook, fila, { data: entregas, error: erroEntregas }] = await Promise.all([
    situacaoDoNumero(),
    kapsoConfigurado() && urlDoWebhook ? situacaoDoWebhook(urlDoWebhook) : Promise.resolve(null),
    montarFila(),
    supabaseServer()
      .from('whatsapp_entregas')
      .select('id, etapa, telefone, modelo, sucesso, erro, criado_em')
      .order('criado_em', { ascending: false })
      .limit(50),
  ])

  const modelos = ETAPAS_DE_RECUPERACAO.map(etapa => ({ etapa, nome: modeloDaEtapa(etapa) }))

  return <>
    <section className="secretaria-bloco">
      <h2>Número da escola no WhatsApp</h2>
      <p className="secretaria-bloco-legenda">
        O número pela Kapso (API oficial do WhatsApp) que manda os lembretes de recuperação. Esta tela só
        consulta a Kapso: abrir o painel não manda mensagem a ninguém.
      </p>

      {mensagem.ok && <p className="secretaria-selo ok" role="status">{mensagem.ok}</p>}
      {mensagem.erro && <p className="secretaria-erro" role="alert">{mensagem.erro}</p>}

      {numero.estado === 'nao_configurado' ? (
        <div className="secretaria-webhook-status espera">
          Não configurado. Defina <code>KAPSO_API_KEY</code> e <code>KAPSO_NUMERO_ID</code> (o Phone number ID do número
          no painel da Kapso) nas variáveis de ambiente da Vercel.
        </div>
      ) : (
        <div className={`secretaria-webhook-status ${numero.estado === 'conectado' ? 'ok' : 'espera'}`}>
          {ESTADO_DO_NUMERO[numero.estado]}
          {numero.numero && ` · ${numero.numero}`}
          {numero.nome && ` · ${numero.nome}`}
          {numero.erro && ` — ${numero.erro}`}
        </div>
      )}

      {kapsoConfigurado() && (
        <div className="secretaria-whatsapp-linha">
          <span>
            Recebimento de mensagens:{' '}
            <strong>
              {webhook === 'ligado' ? 'ligado' : webhook === 'desligado' ? 'desligado'
                : webhook === 'outro_segredo' ? 'ligado com outra senha (ligue de novo)' : 'não foi possível conferir'}
            </strong>
            <span className="secretaria-sub">É por ele que quem responde SAIR deixa de receber. Não responde nada a ninguém.</span>
          </span>
          {webhook !== 'ligado' && urlDoWebhook && (
            <form method="post" action="/secretaria/whatsapp/webhook">
              <button className="text-button" type="submit">Ligar o recebimento</button>
            </form>
          )}
        </div>
      )}
    </section>

    <section className="secretaria-bloco">
      <h2>Recuperação de alunos</h2>
      <div className={`secretaria-webhook-status ${ligado ? 'ok' : 'espera'}`}>
        {ligado
          ? `Envio LIGADO — a rotina diária (10h) manda até ${MAXIMO_POR_RODADA} mensagens por dia, das ${HORARIO_PERMITIDO.inicio}h às ${HORARIO_PERMITIDO.fim}h.`
          : 'Envio DESLIGADO — nada é enviado. A lista abaixo é só a prévia de quem receberia o quê.'}
      </div>
      <p className="secretaria-bloco-legenda">
        Três momentos em que a pessoa para no meio do caminho. Cada um manda no máximo uma mensagem por inscrição, e a
        mesma pessoa recebe no máximo uma por dia. Quem responde SAIR não recebe mais nada.
      </p>

      <div className="secretaria-tabela-rolagem">
        <table className="secretaria-tabela">
          <thead>
            <tr><th>Momento</th><th>Quando</th><th>Modelo aprovado</th></tr>
          </thead>
          <tbody>
            {modelos.map(({ etapa, nome }) => (
              <tr key={etapa}>
                <td><strong>{ROTULOS[etapa]}</strong><span className="secretaria-sub">{MOTIVOS[etapa]}</span></td>
                <td className="secretaria-sub">de {janela(JANELAS[etapa].inicio)} a {janela(JANELAS[etapa].fim)}</td>
                <td>
                  {nome
                    ? <span className="secretaria-selo ok">{nome}</span>
                    : <span className="secretaria-selo espera">falta {variavelDoModelo(etapa)}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!fila.migracaoAplicada && (
        <p className="secretaria-vazio">
          O histórico e a lista de quem pediu para sair ainda não estão disponíveis — a migration{' '}
          <code>0017_whatsapp_recuperacao</code> não foi aplicada neste banco. A prévia abaixo funciona; o envio, não.
        </p>
      )}

      <h3>Quem receberia hoje ({fila.itens.length})</h3>
      {!base ? (
        <p className="secretaria-vazio">Defina NEXT_PUBLIC_SITE_URL: sem o endereço do site, não há link para mandar.</p>
      ) : fila.itens.length === 0 ? (
        <p className="secretaria-vazio">Ninguém na fila agora.</p>
      ) : (
        <div className="secretaria-tabela-rolagem">
          <table className="secretaria-tabela">
            <thead>
              <tr><th>Aluno</th><th>Momento</th><th>Mensagem</th><th></th></tr>
            </thead>
            <tbody>
              {fila.itens.map(item => (
                <tr key={item.inscricaoId}>
                  <td><strong>{item.nome}</strong><span className="secretaria-sub">{item.telefone}</span></td>
                  <td>{ROTULOS[item.etapa]}</td>
                  <td><p className="secretaria-previa">{item.previa}</p></td>
                  <td>
                    {fila.migracaoAplicada && (
                      <form method="post" action="/secretaria/whatsapp/bloquear">
                        <input type="hidden" name="inscricaoId" value={item.inscricaoId} />
                        <button className="text-button" type="submit">Não mandar para esta pessoa</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {fila.bloqueados > 0 && <p className="secretaria-sub">{fila.bloqueados} pessoa(s) pediram para não receber e ficam de fora.</p>}

      <h3>Mensagens enviadas</h3>
      {erroEntregas ? (
        <p className="secretaria-vazio">Sem histórico ainda (migration 0017 não aplicada).</p>
      ) : !entregas?.length ? (
        <p className="secretaria-vazio">Nenhuma mensagem enviada.</p>
      ) : (
        <div className="secretaria-tabela-rolagem">
          <table className="secretaria-tabela">
            <thead>
              <tr><th>Quando</th><th>Momento</th><th>Para</th><th>Resultado</th><th>Detalhe</th></tr>
            </thead>
            <tbody>
              {entregas.map(e => (
                <tr key={e.id}>
                  <td className="secretaria-quando">{dataHora(e.criado_em)}</td>
                  <td>{ROTULOS[e.etapa as keyof typeof ROTULOS] ?? e.etapa}</td>
                  <td className="secretaria-sub">+{String(e.telefone).slice(0, 4)} •••• {String(e.telefone).slice(-4)}</td>
                  <td><span className={`secretaria-selo ${e.sucesso ? 'ok' : 'espera'}`}>{e.sucesso ? 'entregue à Kapso' : 'falhou'}</span></td>
                  <td className="secretaria-sub">{e.modelo}{e.erro ? ` · ${e.erro}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details className="secretaria-contrato">
        <summary>Como ligar, passo a passo</summary>
        <p>
          1. Na Vercel, defina <code>KAPSO_API_KEY</code> (a chave da API da Kapso) e <code>KAPSO_NUMERO_ID</code> (o Phone
          number ID do número). O bloco de cima passa a mostrar o número conectado.
        </p>
        <p>
          2. Toque em &quot;Ligar o recebimento&quot;. Não cadastre a URL à mão no painel da Kapso: ela iria sem a senha.
        </p>
        <p>
          3. Na Kapso, crie os três modelos (idioma Português (BR), com duas variáveis: {'{{1}}'} o primeiro nome e {'{{2}}'} o
          link) e espere a Meta aprovar. Depois, ponha o nome de cada um em <code>KAPSO_MODELO_PIX_ABERTO</code>,{' '}
          <code>KAPSO_MODELO_ABANDONO</code> e <code>KAPSO_MODELO_TRIAGEM</code>. Os textos sugeridos são os da prévia:
        </p>
        {ETAPAS_DE_RECUPERACAO.map(etapa => (
          <p key={etapa}><strong>{ROTULOS[etapa]}:</strong> <span className="secretaria-previa">{TEXTOS_SUGERIDOS[etapa]}</span></p>
        ))}
        <p>
          4. Só quando o responsável pela escola mandar: defina <code>WHATSAPP_RECUPERACAO_ENVIAR=sim</code>. A partir da
          rodada seguinte da rotina (10h), as mensagens começam a sair. A Vercel só lê variável nova num deploy: depois de mudar, publique de novo
          (Redeploy). Para parar, apague a variável e publique de novo.
        </p>
      </details>
    </section>
  </>
}
