/**
 * Recuperação de alunos pelo WhatsApp: quem recebe qual mensagem, e quando.
 *
 * Puro de propósito — sem banco, sem rede, sem `process.env` —, para dar para
 * conferir as regras com `npx tsx scripts/conferir-recuperacao.ts` sem tocar
 * em dado de aluno. Quem lê o banco e quem envia moram em
 * `lib/recuperacao-servidor.ts` e `lib/kapso.ts`.
 *
 * São três momentos do funil em que a pessoa para e quase sempre volta com um
 * lembrete:
 *
 * - `pix_aberto`: abriu a cobrança da matrícula e não pagou. O PIX vale 1 dia
 *   (`DIAS_PARA_EXPIRAR` em app/api/pagamentos/route.ts), então o lembrete só
 *   faz sentido enquanto o código ainda funciona.
 * - `abandono`: preencheu os dados e não pagou, um dia depois. O PIX já
 *   venceu; o convite é voltar ao formulário, que reconhece o CPF e gera outro.
 * - `triagem_pendente`: pagou a matrícula e não respondeu as 8 perguntas. Sem
 *   elas a secretaria não monta a turma — é a matrícula travada em `paga`.
 *
 * Uma mensagem por momento por inscrição, e no máximo uma por dia por pessoa:
 * recuperação que vira insistência espanta mais do que recupera.
 */

export const ETAPAS_DE_RECUPERACAO = ['pix_aberto', 'abandono', 'triagem_pendente'] as const
export type EtapaDeRecuperacao = (typeof ETAPAS_DE_RECUPERACAO)[number]

const HORA = 60 * 60 * 1000
const DIA = 24 * HORA

/**
 * Janela de cada momento, contada do fato que o dispara (a cobrança aberta, a
 * inscrição criada, o pagamento confirmado). Antes do início é cedo — a
 * pessoa pode estar no meio do caminho —; depois do fim, tarde demais para
 * parecer lembrete e não cobrança fria.
 */
export const JANELAS: Record<EtapaDeRecuperacao, { inicio: number; fim: number }> = {
  // Até 22h: o PIX vence em 24h, e lembrar de um código que já morreu é pior que não lembrar.
  pix_aberto: { inicio: 1 * HORA, fim: 22 * HORA },
  abandono: { inicio: 1 * DIA, fim: 7 * DIA },
  triagem_pendente: { inicio: 1 * DIA, fim: 30 * DIA },
}

/** Intervalo mínimo entre duas mensagens de recuperação para a mesma pessoa. */
export const INTERVALO_MINIMO = 20 * HORA

/**
 * Horário de Brasília em que mensagem pode sair: 9h às 20h. A rotina roda uma
 * vez por dia de manhã, mas a trava fica aqui para um disparo manual fora de
 * hora não acordar ninguém.
 */
export const HORARIO_PERMITIDO = { inicio: 9, fim: 20 }

export const ROTULOS: Record<EtapaDeRecuperacao, string> = {
  pix_aberto: 'PIX aberto',
  abandono: 'Parou antes de pagar',
  triagem_pendente: 'Pagou, falta a triagem',
}

/** O que a secretaria lê para saber por que a pessoa está na fila. */
export const MOTIVOS: Record<EtapaDeRecuperacao, string> = {
  pix_aberto: 'Abriu o PIX da matrícula há mais de 1 hora e ainda não pagou.',
  abandono: 'Preencheu os dados há mais de 1 dia e não pagou.',
  triagem_pendente: 'Pagou a matrícula há mais de 1 dia e não respondeu as 8 perguntas.',
}

/**
 * Palavras que tiram a pessoa da recuperação. Comparadas com a mensagem
 * inteira normalizada, nunca com um trecho: "não quero sair do curso" não
 * pode virar descadastro.
 */
export const PALAVRAS_DE_SAIDA = ['sair', 'parar', 'pare', 'stop', 'cancelar', 'descadastrar', 'nao quero', 'nao quero receber', 'remover']

/** Sem acento, minúsculo, só letras, números e um espaço entre as palavras. */
export const normalizar = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

export const pedeParaSair = (texto: string) => PALAVRAS_DE_SAIDA.includes(normalizar(texto))

// --- Número -------------------------------------------------------------

/**
 * Número no formato do WhatsApp: só dígitos, com o 55. `inscricoes.telefone`
 * é gravado com 11 dígitos (DDD + celular com o 9), sem o país — a constraint
 * `telefone_11_digitos` garante. Fora disso, null: não se adivinha número.
 */
export function numeroDoWhatsapp(telefone: string | null | undefined): string | null {
  const d = String(telefone ?? '').replace(/\D/g, '')
  if (/^\d{2}9\d{8}$/.test(d)) return `55${d}`
  if (/^55\d{2}9\d{8}$/.test(d)) return d
  return null
}

/**
 * O mesmo celular sem o nono dígito. O WhatsApp ainda identifica muitas
 * contas antigas assim, e é por esse número que a resposta delas chega — o
 * descadastro precisa reconhecer as duas formas.
 */
export function semNonoDigito(numero: string): string | null {
  const m = /^55(\d{2})9(\d{8})$/.exec(numero)
  return m ? `55${m[1]}${m[2]}` : null
}

/** Volta à forma com o 9, para comparar com o que está gravado. */
export function comNonoDigito(numero: string): string {
  const d = numero.replace(/\D/g, '')
  const m = /^55(\d{2})([6-9]\d{7})$/.exec(d)
  return m ? `55${m[1]}9${m[2]}` : d
}

// --- Quem está na fila --------------------------------------------------

export type InscricaoParaRecuperar = {
  id: string
  nome: string
  telefone: string
  status: 'rascunho' | 'aguardando_pagamento' | 'paga' | 'triagem_concluida' | 'cancelada'
  criadoEm: string
}

export type CobrancaParaRecuperar = {
  etapa: 'matricula' | 'curso' | 'integral'
  status: 'pendente' | 'confirmado' | 'expirado' | 'estornado'
  criadoEm: string
  confirmadoEm: string | null
}

export type EnvioAnterior = { etapa: EtapaDeRecuperacao; criadoEm: string }

export type Contexto = {
  agora: number
  cobrancas: CobrancaParaRecuperar[]
  /** Só os envios que deram certo. */
  enviados: EnvioAnterior[]
  bloqueado: boolean
}

const dentro = (desde: string | null, etapa: EtapaDeRecuperacao, agora: number) => {
  if (!desde) return false
  const passou = agora - new Date(desde).getTime()
  return passou >= JANELAS[etapa].inicio && passou <= JANELAS[etapa].fim
}

/** A cobrança que garante a vaga: `integral` é a forma antiga, de quando matrícula e curso saíam juntos. */
const daMatricula = (c: CobrancaParaRecuperar) => c.etapa === 'matricula' || c.etapa === 'integral'

/**
 * A mensagem que esta inscrição deveria receber agora, ou null. A ordem das
 * checagens é a prioridade: o PIX ainda válido vem antes do convite genérico,
 * porque é o que fecha a venda com um toque.
 */
export function etapaDevida(inscricao: InscricaoParaRecuperar, ctx: Contexto): EtapaDeRecuperacao | null {
  if (ctx.bloqueado) return null
  if (!numeroDoWhatsapp(inscricao.telefone)) return null

  const ultimoEnvio = Math.max(0, ...ctx.enviados.map(e => new Date(e.criadoEm).getTime()))
  if (ctx.agora - ultimoEnvio < INTERVALO_MINIMO) return null

  const jaRecebeu = new Set(ctx.enviados.map(e => e.etapa))
  const matricula = ctx.cobrancas.filter(daMatricula)
  const matriculaPaga = matricula.some(c => c.status === 'confirmado')

  if (inscricao.status === 'aguardando_pagamento' && !matriculaPaga && !jaRecebeu.has('pix_aberto')) {
    // A mais recente: é a que a tela de pagamento mostra.
    const aberta = matricula
      .filter(c => c.status === 'pendente')
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))[0]
    if (aberta && dentro(aberta.criadoEm, 'pix_aberto', ctx.agora)) return 'pix_aberto'
  }

  if ((inscricao.status === 'rascunho' || inscricao.status === 'aguardando_pagamento') && !matriculaPaga && !jaRecebeu.has('abandono')) {
    if (dentro(inscricao.criadoEm, 'abandono', ctx.agora)) return 'abandono'
  }

  if (inscricao.status === 'paga' && !jaRecebeu.has('triagem_pendente')) {
    const pagaEm = matricula
      .filter(c => c.status === 'confirmado' && c.confirmadoEm)
      .map(c => c.confirmadoEm!)
      .sort()[0] ?? null
    if (dentro(pagaEm, 'triagem_pendente', ctx.agora)) return 'triagem_pendente'
  }

  return null
}

// --- Horário --------------------------------------------------------------

/** Hora cheia em Brasília (UTC−3, sem horário de verão desde 2019). */
export const horaEmBrasilia = (agora: number) => new Date(agora - 3 * HORA).getUTCHours()

export const dentroDoHorario = (agora: number) => {
  const h = horaEmBrasilia(agora)
  return h >= HORARIO_PERMITIDO.inicio && h < HORARIO_PERMITIDO.fim
}

// --- Texto ----------------------------------------------------------------

/** Primeiro nome, que é como a secretaria fala com o aluno. */
export const primeiroNome = (nome: string) => {
  const p = nome.trim().split(/\s+/)[0] ?? ''
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : ''
}

/**
 * O link de volta, com a origem marcada. A atribuição de `inscricoes` é de
 * primeiro toque (`coalesce` em `upsert_inscricao`), então estas UTMs nunca
 * roubam o crédito do anúncio que trouxe a pessoa — servem para a visita e
 * para a cobrança (`utm_content` da Únicopag) mostrarem que a volta veio
 * daqui. Vai para o formulário, e não para `?etapa=pagamento`: no celular, o
 * link do WhatsApp abre um navegador sem o cookie da sessão; o formulário
 * reconhece o CPF e retoma de onde parou.
 */
export function linkDeVolta(base: string, etapa: EtapaDeRecuperacao) {
  const url = new URL('/inscricao', base)
  url.searchParams.set('utm_source', 'whatsapp')
  url.searchParams.set('utm_medium', 'recuperacao')
  url.searchParams.set('utm_campaign', `recuperacao_${etapa}`)
  return url.toString()
}

/**
 * As variáveis do modelo, na ordem: {{1}} o primeiro nome, {{2}} o link.
 * Fora da janela de 24h a Meta só deixa sair modelo aprovado, e o texto é o
 * que foi aprovado — daqui saem só as duas variáveis.
 */
export const variaveisDoModelo = (nome: string, link: string) => [primeiroNome(nome) || 'tudo bem', link]

/**
 * Texto sugerido para cadastrar cada modelo na Kapso (Meta). É também a
 * prévia que o painel mostra: o que a pessoa vai ler, com as variáveis
 * preenchidas. Se o texto aprovado for outro, a prévia precisa acompanhar.
 */
export const TEXTOS_SUGERIDOS: Record<EtapaDeRecuperacao, string> = {
  pix_aberto:
    'Oi, {{1}}! Aqui é a secretaria da Cruz Vermelha RJ. Sua vaga no Curso de Punção Venosa está reservada, mas o PIX da matrícula ainda não caiu. O código vale até amanhã — é só voltar por aqui: {{2}}\n\nSe preferir não receber estas mensagens, responda SAIR.',
  abandono:
    'Oi, {{1}}! Aqui é a secretaria da Cruz Vermelha RJ. Vimos que sua inscrição no Curso de Punção Venosa ficou pela metade. Ainda dá tempo: informe seu CPF e continue de onde parou: {{2}}\n\nSe tiver alguma dúvida, é só responder esta mensagem. Para não receber mais, responda SAIR.',
  triagem_pendente:
    'Oi, {{1}}! Sua matrícula no Curso de Punção Venosa está paga. Falta só responder 8 perguntas rápidas sobre seus dias e horários — é com elas que montamos sua turma: {{2}}\n\nPara não receber mais estas mensagens, responda SAIR.',
}

export const previa = (etapa: EtapaDeRecuperacao, variaveis: string[]) =>
  TEXTOS_SUGERIDOS[etapa].replace(/\{\{(\d)\}\}/g, (_, n) => variaveis[Number(n) - 1] ?? '')
