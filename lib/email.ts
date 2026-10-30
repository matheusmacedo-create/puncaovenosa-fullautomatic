import { after } from 'next/server'
import { courseData, institutionContact, INSTITUTION_NAME } from '@/lib/course-data'
import { COBRA_CURSO_A_PARTE, formatarBRL, PRECO_CENTAVOS, PRECO_CURSO_CENTAVOS, PRECO_MATRICULA_CENTAVOS, ROTA_INSCRICAO } from '@/lib/enrollment'
import { assinar, urlAssinada, type Finalidade } from '@/lib/link-assinado'
import { TIPOS_DE_LEMBRETE, type TipoDeLembrete } from '@/lib/lembretes-regras'
import { siteUrl } from '@/lib/site-url'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * E-mails transacionais para o aluno, pela Resend.
 *
 * Gêmeo de `lib/webhook-secretaria.ts` para o outro lado da conversa: lá é o
 * que a secretaria recebe, aqui é o que o aluno recebe. Mesmas três regras,
 * pelos mesmos motivos — nunca lança (provedor fora do ar não pode derrubar
 * uma inscrição), roda em `after()` (o aluno não espera o e-mail sair) e
 * grava toda tentativa em `email_entregas`, que é o que /secretaria lê para
 * mostrar o que não chegou.
 *
 * O disparo é sempre de **transição**, nunca de consulta: `/api/pagamentos/atual`
 * roda a cada 10 segundos, e um e-mail por consulta seria uma caixa de
 * entrada cheia do mesmo comprovante. A rede de segurança contra corrida
 * entre o postback e a consulta é o índice único parcial da migration 0015.
 *
 * A chave nunca mora no repositório: só `.env.local` (fora do Git) ou a
 * Vercel. Sem `RESEND_API_KEY` e `EMAIL_REMETENTE`, tudo aqui é no-op — igual
 * ao webhook e à planilha.
 *
 * Os lembretes de recuperação (`lembrete_*`) são a exceção à regra da
 * transição: saem da varredura diária em `lib/lembretes.ts`, que decide quem
 * recebe. O envio, o log e a barreira contra repetição são os mesmos daqui.
 */

export const TIPOS_DE_EMAIL = [
  'cobranca_aberta',
  'matricula_paga',
  'curso_pago',
  'triagem_concluida',
  ...TIPOS_DE_LEMBRETE,
] as const

export type TipoDeEmail = (typeof TIPOS_DE_EMAIL)[number]

const CHAVE = () => process.env.RESEND_API_KEY?.trim()
/** Precisa ser um domínio verificado na Resend, senão ela recusa o envio. */
const REMETENTE = () => process.env.EMAIL_REMETENTE?.trim()

export function emailConfigurado() {
  return Boolean(CHAVE() && REMETENTE())
}

// --- Aparência ---------------------------------------------------------
// Estilo inline em tudo: cliente de e-mail ignora folha de estilo, e vários
// removem a tag <style> inteira. Sem imagem também — Gmail e Outlook
// bloqueiam imagem remota por padrão, então um cabeçalho que dependesse do
// logo chegaria vazio na maioria das caixas.

const VERMELHO = '#c8102e'
const TINTA = '#16181c'
const TINTA_FRACA = '#5a6068'
const REGUA = '#e3e1dc'

function moldura(titulo: string, corpo: string, rodapeExtra = '') {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${titulo}</title></head>
<body style="margin:0;padding:24px 12px;background:#fbfaf8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${TINTA};line-height:1.5">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid ${REGUA}">
    <tr><td style="height:6px;background:${VERMELHO};font-size:0;line-height:0">&nbsp;</td></tr>
    <tr><td style="padding:28px 28px 8px">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:${VERMELHO};font-weight:700">${INSTITUTION_NAME}</p>
      <h1 style="margin:0;font-size:22px;line-height:1.2">${titulo}</h1>
    </td></tr>
    <tr><td style="padding:8px 28px 28px;font-size:15px">${corpo}</td></tr>
    <tr><td style="padding:18px 28px;border-top:1px solid ${REGUA};font-size:12px;color:${TINTA_FRACA}">
      <p style="margin:0 0 6px">Dúvidas? Fale com a secretaria no WhatsApp ${institutionContact.whatsappLabel}.</p>
      <p style="margin:0">${institutionContact.addressShort}</p>${rodapeExtra}
    </td></tr>
  </table>
</body></html>`
}

const botao = (url: string, rotulo: string) =>
  `<p style="margin:22px 0"><a href="${url}" style="display:inline-block;background:${VERMELHO};color:#ffffff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:3px">${rotulo}</a></p>`

const paragrafo = (texto: string) => `<p style="margin:0 0 12px">${texto}</p>`

/** Escapa o que vem do banco: nome de aluno entra no HTML do e-mail. */
const escapar = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// --- Conteúdo ----------------------------------------------------------

type Dados = {
  nome: string
  numeroInscricao: string | null
  valorCentavos: number | null
  pixCopiaCola: string | null
}

type Mensagem = { assunto: string; html: string; texto: string }

/**
 * Endereços que a mensagem pode citar. Com `LINK_ASSINADO_SEGREDO`, cada um
 * passa por /retomar e abre a sessão no navegador onde o e-mail foi aberto;
 * sem ele, é o caminho comum, que só funciona no navegador do cadastro.
 */
type Links = {
  pagamento: string | null
  triagem: string | null
  ficha: string | null
  /** Página de confirmação para parar os lembretes. Só existe assinada. */
  pararLembretes: string | null
  /** Destino do `List-Unsubscribe` de um clique (RFC 8058). Só existe assinado. */
  pararLembretesUmClique: string | null
}

/** Validade dos links de retomada: a mesma do cookie de sessão que eles abrem. */
const DIAS_DO_LINK = 30
/** O pedido para parar precisa funcionar mesmo num e-mail antigo. */
const DIAS_DO_LINK_PARAR = 180

export function montarLinks(inscricaoId: string): Links {
  const base = siteUrl()
  if (!base) return { pagamento: null, triagem: null, ficha: null, pararLembretes: null, pararLembretesUmClique: null }

  const retomar = (finalidade: Finalidade, caminhoComum: string) => {
    const p = assinar(inscricaoId, finalidade, DIAS_DO_LINK)
    return p ? urlAssinada(base, '/retomar', p) : `${base}${caminhoComum}`
  }
  const parar = assinar(inscricaoId, 'parar_lembretes', DIAS_DO_LINK_PARAR)

  return {
    pagamento: retomar('pagamento', `${ROTA_INSCRICAO}?etapa=pagamento`),
    triagem: retomar('triagem', '/triagem/1'),
    ficha: retomar('ficha', '/minha-inscricao'),
    pararLembretes: parar ? urlAssinada(base, '/lembretes/parar', parar) : null,
    pararLembretesUmClique: parar ? urlAssinada(base, '/api/lembretes/parar', parar) : null,
  }
}

export const ehLembrete = (tipo: TipoDeEmail): tipo is TipoDeLembrete =>
  (TIPOS_DE_LEMBRETE as readonly string[]).includes(tipo)

/** Primeiro nome, que é como a secretaria fala com o aluno. */
const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? nome

export function montarMensagem(tipo: TipoDeEmail, dados: Dados, links: Links): Mensagem {
  const { ficha } = links
  const oi = `Oi, ${escapar(primeiroNome(dados.nome))}.`
  const curso = courseData.courseName

  if (tipo === 'cobranca_aberta') {
    const assunto = `Seu código PIX do ${curso}`
    const corpo = [
      paragrafo(`${oi} Sua vaga está reservada, e o código abaixo é o que confirma a matrícula.`),
      dados.valorCentavos
        ? paragrafo(`Valor da matrícula: <strong>${formatarBRL(dados.valorCentavos)}</strong>.`)
        : '',
      dados.pixCopiaCola
        ? `<p style="margin:0 0 6px;font-size:13px;color:${TINTA_FRACA}">PIX copia e cola:</p>
           <p style="margin:0 0 12px;padding:12px;background:#f6f5f2;border:1px solid ${REGUA};font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;word-break:break-all">${escapar(dados.pixCopiaCola)}</p>`
        : '',
      paragrafo('Abra o aplicativo do seu banco, escolha PIX Copia e Cola e conclua o pagamento. A vaga fica garantida assim que ele cair.'),
      links.pagamento ? botao(links.pagamento, 'Voltar para o pagamento') : '',
    ].join('')
    const texto = [
      `${primeiroNome(dados.nome)}, sua vaga no ${curso} está reservada.`,
      dados.valorCentavos ? `Matrícula: ${formatarBRL(dados.valorCentavos)}.` : '',
      dados.pixCopiaCola ? `\nPIX copia e cola:\n${dados.pixCopiaCola}\n` : '',
      'Abra o app do seu banco, escolha PIX Copia e Cola e conclua o pagamento.',
    ].filter(Boolean).join('\n')
    return { assunto, html: moldura('Sua matrícula está reservada', corpo), texto }
  }

  if (tipo === 'matricula_paga') {
    const assunto = `Matrícula confirmada — ${curso}`
    const corpo = [
      paragrafo(`${oi} Recebemos o pagamento da sua matrícula. <strong>Sua vaga está garantida.</strong>`),
      dados.numeroInscricao
        ? paragrafo(`Número da sua inscrição: <strong>${escapar(dados.numeroInscricao)}</strong>.`)
        : '',
      dados.valorCentavos ? paragrafo(`Valor pago: ${formatarBRL(dados.valorCentavos)}.`) : '',
      paragrafo('<strong>Falta um passo:</strong> responder 8 perguntas rápidas sobre os dias e horários que funcionam para você. É a partir delas que a secretaria monta a sua turma.'),
      links.triagem ? botao(links.triagem, 'Responder as 8 perguntas') : '',
      COBRA_CURSO_A_PARTE
        ? paragrafo(`<span style="color:${TINTA_FRACA}">Sobre o restante: o curso (${formatarBRL(PRECO_CURSO_CENTAVOS)}) você paga até o dia da aula, fechando o investimento total de ${formatarBRL(PRECO_CENTAVOS)}. O código fica guardado na sua ficha de inscrição.</span>`)
        : '',
      ficha ? paragrafo(`<a href="${ficha}" style="color:${VERMELHO}">Ver minha ficha de inscrição</a>`) : '',
    ].join('')
    const texto = [
      `${primeiroNome(dados.nome)}, sua matrícula no ${curso} está confirmada e sua vaga garantida.`,
      dados.numeroInscricao ? `Inscrição ${dados.numeroInscricao}.` : '',
      'Falta responder 8 perguntas rápidas sobre dias e horários — é com elas que a secretaria monta sua turma.',
      ficha ? `Ficha: ${ficha}` : '',
    ].filter(Boolean).join('\n')
    return { assunto, html: moldura('Matrícula confirmada', corpo), texto }
  }

  if (tipo === 'curso_pago') {
    const assunto = `Pagamento do curso confirmado — ${curso}`
    const corpo = [
      paragrafo(`${oi} Recebemos o pagamento do curso. <strong>Sua inscrição está quitada</strong> — não há mais nada a pagar.`),
      dados.numeroInscricao ? paragrafo(`Inscrição <strong>${escapar(dados.numeroInscricao)}</strong>.`) : '',
      paragrafo(`Lembretes para o dia: leve ${courseData.foodDonation} e um documento com foto. O certificado é entregue presencialmente ao final do curso.`),
      ficha ? botao(ficha, 'Ver minha inscrição') : '',
    ].join('')
    const texto = `${primeiroNome(dados.nome)}, o pagamento do curso foi confirmado e sua inscrição está quitada.`
    return { assunto, html: moldura('Inscrição quitada', corpo), texto }
  }

  if (ehLembrete(tipo)) return montarLembrete(tipo, dados, links)

  const assunto = `Recebemos suas respostas — ${curso}`
  const corpo = [
    paragrafo(`${oi} Recebemos suas disponibilidades. A secretaria analisa os horários e entra em contato pelo WhatsApp para confirmar a sua turma.`),
    paragrafo(`Lembretes para o dia: leve ${courseData.foodDonation} e um documento com foto.`),
    ficha ? botao(ficha, 'Ver minha inscrição') : '',
  ].join('')
  const texto = `${primeiroNome(dados.nome)}, recebemos suas disponibilidades. A secretaria entra em contato pelo WhatsApp para confirmar a turma.`
  return { assunto, html: moldura('Recebemos suas respostas', corpo), texto }
}

/**
 * Os lembretes de recuperação. Tom de secretaria, não de loja: sem contagem
 * regressiva nem "últimas vagas" — `maxSeatsPerClass` é nulo justamente
 * porque não há número de vagas confirmado, e um e-mail não pode afirmar o
 * que a página se recusa a afirmar.
 */
function montarLembrete(tipo: TipoDeLembrete, dados: Dados, links: Links): Mensagem {
  const nome = primeiroNome(dados.nome)
  const oi = `Oi, ${escapar(nome)}.`
  const curso = courseData.courseName
  const matricula = formatarBRL(PRECO_MATRICULA_CENTAVOS)
  const rodape = links.pararLembretes
    ? `<p style="margin:10px 0 0">Você recebe este lembrete porque começou uma inscrição no ${curso}. <a href="${links.pararLembretes}" style="color:${TINTA_FRACA}">Não quero mais receber lembretes</a>.</p>`
    : ''
  const rodapeTexto = links.pararLembretes ? `\n\nPara não receber mais lembretes: ${links.pararLembretes}` : ''

  if (tipo === 'lembrete_triagem') {
    const assunto = `Falta um passo para montar sua turma — ${curso}`
    const corpo = [
      paragrafo(`${oi} Sua matrícula está paga${dados.numeroInscricao ? ` (inscrição <strong>${escapar(dados.numeroInscricao)}</strong>)` : ''}, mas ainda faltam as 8 perguntas sobre os dias e horários que funcionam para você.`),
      paragrafo('É com essas respostas que a secretaria encaixa você numa turma. Sem elas, sua inscrição fica parada nesse ponto. Leva cerca de dois minutos.'),
      links.triagem ? botao(links.triagem, 'Responder as 8 perguntas') : '',
      paragrafo(`<span style="color:${TINTA_FRACA}">Se alguma pergunta gerar dúvida, a secretaria responde pelo WhatsApp ${institutionContact.whatsappLabel}.</span>`),
    ].join('')
    const texto = [
      `${nome}, sua matrícula no ${curso} está paga, mas faltam as 8 perguntas sobre dias e horários.`,
      'É com elas que a secretaria monta sua turma. Leva cerca de dois minutos.',
      links.triagem ? `Responder: ${links.triagem}` : '',
    ].filter(Boolean).join('\n') + rodapeTexto
    return { assunto, html: moldura('Falta um passo', corpo, rodape), texto }
  }

  if (tipo === 'lembrete_pagamento_1') {
    const assunto = `Sua matrícula no ${curso} ficou no pagamento`
    const corpo = [
      paragrafo(`${oi} Você começou sua matrícula no ${curso}, mas ela parou no pagamento.`),
      paragrafo(`Para garantir a vaga, falta só a matrícula: <strong>${matricula}</strong>, no PIX ou no cartão. Seus dados já estão preenchidos.`),
      links.pagamento ? botao(links.pagamento, 'Concluir minha matrícula') : '',
      paragrafo(`<span style="color:${TINTA_FRACA}">Se o código PIX anterior venceu, um novo é gerado na hora, quando você abrir o link.</span>`),
    ].join('')
    const texto = [
      `${nome}, sua matrícula no ${curso} parou no pagamento.`,
      `Para garantir a vaga, falta a matrícula: ${matricula}, no PIX ou no cartão.`,
      links.pagamento ? `Concluir: ${links.pagamento}` : '',
    ].filter(Boolean).join('\n') + rodapeTexto
    return { assunto, html: moldura('Sua matrícula ficou no pagamento', corpo, rodape), texto }
  }

  // lembrete_pagamento_2: o último. Responde às dúvidas que costumam
  // segurar o pagamento, em vez de repetir o mesmo pedido.
  const assunto = `Ainda quer fazer o ${curso}?`
  const corpo = [
    paragrafo(`${oi} Este é o último lembrete sobre a sua matrícula no ${curso}, que ainda não foi concluída.`),
    paragrafo('Se ficou alguma dúvida, talvez isto ajude:'),
    `<ul style="margin:0 0 12px;padding-left:20px">
      <li style="margin:0 0 6px">O curso é presencial, com ${courseData.duration} de duração, na sede da ${INSTITUTION_NAME}, no ${courseData.locationLabel}.</li>
      <li style="margin:0 0 6px">Agora você paga só a matrícula (${matricula}), que garante a vaga.${COBRA_CURSO_A_PARTE ? ` O curso (${formatarBRL(PRECO_CURSO_CENTAVOS)}) fica para depois, até o dia da aula.` : ''}</li>
      <li style="margin:0 0 6px">Depois de pagar, você tem ${courseData.refundWindowDays} dias para desistir e receber o valor de volta.</li>
    </ul>`,
    links.pagamento ? botao(links.pagamento, 'Concluir minha matrícula') : '',
    paragrafo(`<span style="color:${TINTA_FRACA}">Se preferir conversar antes, a secretaria atende pelo WhatsApp ${institutionContact.whatsappLabel}. Se mudou de ideia, não precisa fazer nada — não mandaremos outro lembrete.</span>`),
  ].join('')
  const texto = [
    `${nome}, este é o último lembrete sobre a sua matrícula no ${curso}.`,
    `Agora você paga só a matrícula (${matricula}), que garante a vaga, e tem ${courseData.refundWindowDays} dias para desistir com reembolso.`,
    links.pagamento ? `Concluir: ${links.pagamento}` : '',
    `Dúvidas: WhatsApp ${institutionContact.whatsappLabel}.`,
  ].filter(Boolean).join('\n') + rodapeTexto
  return { assunto, html: moldura('Último lembrete da sua matrícula', corpo, rodape), texto }
}

// --- Envio -------------------------------------------------------------

/**
 * Lê o estado atual do banco em vez de receber pronto de quem chamou —
 * mesmo padrão de `montarPayload` no webhook. Assim o e-mail sempre reflete
 * o que está gravado, inclusive num reenvio disparado bem depois.
 */
async function carregarDados(inscricaoId: string, pagamentoId?: string) {
  const supabase = supabaseServer()

  const { data: inscricao } = await supabase
    .from('inscricoes')
    .select('nome, email, numero_inscricao')
    .eq('id', inscricaoId)
    .maybeSingle()

  if (!inscricao?.email) return null

  let valorCentavos: number | null = null
  let pixCopiaCola: string | null = null
  if (pagamentoId) {
    const { data: pagamento } = await supabase
      .from('pagamentos')
      .select('valor_centavos, pix_copia_cola')
      .eq('id', pagamentoId)
      .maybeSingle()
    valorCentavos = pagamento?.valor_centavos ?? null
    pixCopiaCola = pagamento?.pix_copia_cola ?? null
  }

  return {
    destinatario: inscricao.email,
    dados: { nome: inscricao.nome, numeroInscricao: inscricao.numero_inscricao, valorCentavos, pixCopiaCola },
  }
}

async function registrar(
  inscricaoId: string,
  tipo: TipoDeEmail,
  destinatario: string,
  assunto: string,
  sucesso: boolean,
  provedorId: string | null,
  erro: string | null,
) {
  const { error } = await supabaseServer().from('email_entregas').insert({
    inscricao_id: inscricaoId,
    tipo,
    destinatario,
    assunto,
    sucesso,
    provedor_id: provedorId,
    erro,
  })
  // Violação do índice único é o caso esperado numa corrida entre o postback
  // e a consulta: o e-mail já saiu, e não sair de novo é exatamente o certo.
  if (error && error.code !== '23505') console.error('[email] falha ao registrar entrega:', error)
}

/** Diz se a mensagem saiu agora — `false` também quando já tinha saído antes. */
async function enviar(inscricaoId: string, tipo: TipoDeEmail, pagamentoId?: string): Promise<boolean> {
  const alvo = await carregarDados(inscricaoId, pagamentoId)
  if (!alvo) return false

  // Já enviado com sucesso: não repete. O índice único cobre a corrida, mas
  // conferir antes evita gastar uma chamada ao provedor para ser recusado
  // pelo banco logo depois.
  const { data: jaEnviado } = await supabaseServer()
    .from('email_entregas')
    .select('id')
    .eq('inscricao_id', inscricaoId)
    .eq('tipo', tipo)
    .eq('sucesso', true)
    .maybeSingle()
  if (jaEnviado) return false

  const links = montarLinks(inscricaoId)
  const { assunto, html, texto } = montarMensagem(tipo, alvo.dados, links)

  // Descadastro de um clique (RFC 8058), só nos lembretes: Gmail e Yahoo
  // mostram o botão "cancelar inscrição" ao lado do remetente, e quem não
  // quer mais prefere isso a marcar como spam — o que derrubaria a entrega
  // dos comprovantes, que saem do mesmo domínio.
  const cabecalhos = ehLembrete(tipo) && links.pararLembretesUmClique
    ? { 'List-Unsubscribe': `<${links.pararLembretesUmClique}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
    : undefined

  try {
    const resposta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CHAVE()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: REMETENTE(),
        to: [alvo.destinatario],
        subject: assunto,
        html,
        text: texto,
        headers: cabecalhos,
      }),
      signal: AbortSignal.timeout(10_000),
    })

    if (resposta.ok) {
      const corpo = (await resposta.json().catch(() => ({}))) as { id?: string }
      await registrar(inscricaoId, tipo, alvo.destinatario, assunto, true, corpo.id ?? null, null)
      return true
    } else {
      const texto = await resposta.text().catch(() => '')
      console.error('[email] recusado:', resposta.status, texto)
      await registrar(inscricaoId, tipo, alvo.destinatario, assunto, false, null, `${resposta.status} ${texto}`.slice(0, 500))
    }
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : 'falha desconhecida'
    console.error('[email] falhou ao enviar:', e)
    await registrar(inscricaoId, tipo, alvo.destinatario, assunto, false, null, mensagem)
  }
  return false
}

/**
 * Agenda o envio para depois da resposta ao aluno. Sem as variáveis, no-op.
 *
 * Chame apenas na **transição** — o mesmo ponto onde `notificarSecretaria`
 * é chamado —, nunca num caminho de consulta.
 */
export function enviarEmailTransacional(inscricaoId: string, tipo: TipoDeEmail, pagamentoId?: string) {
  if (!emailConfigurado()) return
  after(async () => {
    try {
      await enviar(inscricaoId, tipo, pagamentoId)
    } catch (e) {
      console.error('[email] erro inesperado:', e)
    }
  })
}

/**
 * Comprovante de uma cobrança confirmada.
 *
 * Qual dos dois depende da etapa que ela cobria, e por isso a leitura fica
 * aqui: os três pontos que confirmam pagamento (a tela, o postback e a
 * consulta ao provedor) não precisam saber dessa regra. `integral` é a
 * cobrança antiga, de quando matrícula e curso saíam juntas — ela garante a
 * vaga, então recebe o comprovante de matrícula.
 */
export function enviarComprovanteDePagamento(inscricaoId: string, pagamentoId: string) {
  if (!emailConfigurado()) return
  after(async () => {
    try {
      const { data } = await supabaseServer()
        .from('pagamentos')
        .select('etapa')
        .eq('id', pagamentoId)
        .maybeSingle()
      await enviar(inscricaoId, data?.etapa === 'curso' ? 'curso_pago' : 'matricula_paga', pagamentoId)
    } catch (e) {
      console.error('[email] erro inesperado no comprovante:', e)
    }
  })
}

/** Reenvio manual pelo painel, fora do fluxo do aluno. */
export async function reenviarEmailTransacional(inscricaoId: string, tipo: TipoDeEmail, pagamentoId?: string) {
  if (!emailConfigurado()) return
  await enviar(inscricaoId, tipo, pagamentoId)
}

/**
 * Lembrete de recuperação, chamado pela varredura diária (`lib/lembretes.ts`),
 * que já decidiu quem recebe. Espera o envio — a varredura é o cron, não há
 * aluno esperando resposta — e nunca lança.
 */
export async function enviarLembrete(inscricaoId: string, tipo: TipoDeLembrete): Promise<boolean> {
  if (!emailConfigurado()) return false
  try {
    return await enviar(inscricaoId, tipo)
  } catch (e) {
    console.error('[email] erro inesperado no lembrete:', e)
    return false
  }
}
