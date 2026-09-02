import { after } from 'next/server'
import { courseData, institutionContact, INSTITUTION_NAME } from '@/lib/course-data'
import { COBRA_CURSO_A_PARTE, formatarBRL, PRECO_CENTAVOS, PRECO_CURSO_CENTAVOS, ROTA_INSCRICAO } from '@/lib/enrollment'
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
 */

export const TIPOS_DE_EMAIL = [
  'cobranca_aberta',
  'matricula_paga',
  'curso_pago',
  'triagem_concluida',
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

function moldura(titulo: string, corpo: string) {
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
      <p style="margin:0">${institutionContact.addressShort}</p>
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

/** Primeiro nome, que é como a secretaria fala com o aluno. */
const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? nome

function montarMensagem(tipo: TipoDeEmail, dados: Dados): Mensagem {
  const base = siteUrl()
  const ficha = base ? `${base}/minha-inscricao` : null
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
      ficha ? botao(`${base}${ROTA_INSCRICAO}?etapa=pagamento`, 'Voltar para o pagamento') : '',
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
      ficha ? botao(`${siteUrl()}/triagem/1`, 'Responder as 8 perguntas') : '',
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

  const assunto = `Recebemos suas respostas — ${curso}`
  const corpo = [
    paragrafo(`${oi} Recebemos suas disponibilidades. A secretaria analisa os horários e entra em contato pelo WhatsApp para confirmar a sua turma.`),
    paragrafo(`Lembretes para o dia: leve ${courseData.foodDonation} e um documento com foto.`),
    ficha ? botao(ficha, 'Ver minha inscrição') : '',
  ].join('')
  const texto = `${primeiroNome(dados.nome)}, recebemos suas disponibilidades. A secretaria entra em contato pelo WhatsApp para confirmar a turma.`
  return { assunto, html: moldura('Recebemos suas respostas', corpo), texto }
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

async function enviar(inscricaoId: string, tipo: TipoDeEmail, pagamentoId?: string) {
  const alvo = await carregarDados(inscricaoId, pagamentoId)
  if (!alvo) return

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
  if (jaEnviado) return

  const { assunto, html, texto } = montarMensagem(tipo, alvo.dados)

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
      }),
      signal: AbortSignal.timeout(10_000),
    })

    if (resposta.ok) {
      const corpo = (await resposta.json().catch(() => ({}))) as { id?: string }
      await registrar(inscricaoId, tipo, alvo.destinatario, assunto, true, corpo.id ?? null, null)
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
