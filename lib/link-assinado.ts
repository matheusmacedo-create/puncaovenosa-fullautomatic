import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Links assinados que os e-mails levam ao aluno.
 *
 * A sessão do funil é o cookie `cvb_inscricao`, que só existe no navegador
 * onde a pessoa se cadastrou. O e-mail quase nunca é aberto nele: o app do
 * Gmail abre o link no navegador embutido, o computador do trabalho não tem
 * o cookie do celular. Sem isto, o botão "Voltar para o pagamento" caía num
 * funil vazio — e um lembrete de recuperação que leva a um formulário em
 * branco não recupera ninguém.
 *
 * O link carrega o id da inscrição, a finalidade e a validade, assinados por
 * HMAC-SHA256 com `LINK_ASSINADO_SEGREDO`. Não é o `token_validacao`: esse
 * vai impresso no QR Code da ficha, e quem lesse o QR abriria a sessão do
 * aluno. Sem a variável, `assinar` devolve `null` e quem chama cai no link
 * comum, como antes — e os lembretes não saem, porque sem retomada eles não
 * servem para nada.
 *
 * Módulo puro de propósito (só `node:crypto`): é conferido por script, sem
 * banco nem Next.
 */

/** Para onde o link leva depois de abrir a sessão. */
export const FINALIDADES = ['pagamento', 'curso', 'triagem', 'ficha', 'parar_lembretes'] as const
export type Finalidade = (typeof FINALIDADES)[number]

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SEGREDO = () => {
  const v = process.env.LINK_ASSINADO_SEGREDO?.trim()
  // Segredo curto é adivinhável por força bruta fora do ar: quem tem um link
  // válido testa candidatos até a assinatura bater, sem tocar no servidor.
  return v && v.length >= 32 ? v : null
}

export function linkAssinadoConfigurado() {
  return SEGREDO() !== null
}

/** Base64url sem preenchimento: nada de `=`, `+` ou `/` para quebrar na URL. */
const base64url = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

function assinatura(segredo: string, inscricaoId: string, finalidade: Finalidade, expira: number) {
  return base64url(createHmac('sha256', segredo).update(`${inscricaoId}.${finalidade}.${expira}`).digest())
}

export type Parametros = { i: string; f: Finalidade; x: string; s: string }

/**
 * Parâmetros de um link válido por `dias`. `agora` existe para o script de
 * conferência; quem chama no app não passa.
 */
export function assinar(inscricaoId: string, finalidade: Finalidade, dias: number, agora = Date.now()): Parametros | null {
  const segredo = SEGREDO()
  if (!segredo || !UUID.test(inscricaoId)) return null
  const expira = Math.floor(agora / 1000) + Math.round(dias * 86_400)
  return { i: inscricaoId, f: finalidade, x: String(expira), s: assinatura(segredo, inscricaoId, finalidade, expira) }
}

export type Verificacao =
  | { ok: true; inscricaoId: string; finalidade: Finalidade }
  | { ok: false; motivo: 'sem_segredo' | 'malformado' | 'expirado' | 'assinatura' }

/** Confere um link recebido. Comparação em tempo constante. */
export function verificar(p: Record<string, string | null | undefined>, agora = Date.now()): Verificacao {
  const segredo = SEGREDO()
  if (!segredo) return { ok: false, motivo: 'sem_segredo' }

  const { i, f, x, s } = p
  if (!i || !f || !x || !s || !UUID.test(i) || !(FINALIDADES as readonly string[]).includes(f) || !/^\d{1,12}$/.test(x)) {
    return { ok: false, motivo: 'malformado' }
  }

  const esperada = Buffer.from(assinatura(segredo, i, f as Finalidade, Number(x)))
  const recebida = Buffer.from(s)
  // Confere a assinatura antes da validade: um link adulterado é recusado
  // como adulterado, não como "expirado", que convidaria a tentar de novo.
  if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) {
    return { ok: false, motivo: 'assinatura' }
  }
  if (Number(x) * 1000 < agora) return { ok: false, motivo: 'expirado' }

  return { ok: true, inscricaoId: i, finalidade: f as Finalidade }
}

/** Monta a URL absoluta de um caminho com os parâmetros assinados. */
export function urlAssinada(base: string, caminho: string, p: Parametros) {
  return `${base}${caminho}?${new URLSearchParams(p)}`
}
