import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto'

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
 * HMAC-SHA256. Não é o `token_validacao`: esse vai impresso no QR Code da
 * ficha, e quem lesse o QR abriria a sessão do aluno.
 *
 * A chave é `LINK_ASSINADO_SEGREDO`, quando definida; sem ela, é derivada
 * (HKDF, com rótulo próprio) da chave secreta do Supabase que o servidor já
 * tem — um segredo a menos para criar, copiar e esquecer. A derivação é de
 * mão única: quem tem um link não chega à chave do banco. Consequência
 * assumida: trocar a chave do Supabase invalida os links já enviados. Sem
 * nenhuma das duas, `assinar` devolve `null`, quem chama cai no link comum e
 * os lembretes não saem — sem retomada eles não servem para nada.
 *
 * Módulo puro de propósito (só `node:crypto`): é conferido por script, sem
 * banco nem Next.
 */

/** Para onde o link leva depois de abrir a sessão. */
export const FINALIDADES = ['pagamento', 'curso', 'triagem', 'ficha', 'parar_lembretes'] as const
export type Finalidade = (typeof FINALIDADES)[number]

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SEGREDO = (): string | Buffer | null => {
  const v = process.env.LINK_ASSINADO_SEGREDO?.trim()
  // Segredo curto é adivinhável por força bruta fora do ar: quem tem um link
  // válido testa candidatos até a assinatura bater, sem tocar no servidor.
  if (v && v.length >= 32) return v
  const chaveDoBanco = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim()
  if (!chaveDoBanco || chaveDoBanco.length < 32) return null
  return Buffer.from(hkdfSync('sha256', chaveDoBanco, 'cvb-puncao', 'link-assinado:v1', 32))
}

export function linkAssinadoConfigurado() {
  return SEGREDO() !== null
}

/** Base64url sem preenchimento: nada de `=`, `+` ou `/` para quebrar na URL. */
const base64url = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/**
 * O e-mail entra na assinatura mas não na URL: o link só vale enquanto a
 * inscrição tiver o mesmo endereço para onde ele foi mandado. Um e-mail
 * digitado errado e corrigido depois, ou trocado por outra pessoa no mesmo
 * CPF, invalida os links que saíram para o endereço antigo — senão quem
 * recebeu por engano abriria a sessão de outra pessoa por 30 dias.
 */
const normalizarEmail = (email: string) => email.trim().toLowerCase()

function assinatura(segredo: string | Buffer, inscricaoId: string, email: string, finalidade: Finalidade, expira: number) {
  return base64url(createHmac('sha256', segredo).update(`${inscricaoId}.${finalidade}.${expira}.${normalizarEmail(email)}`).digest())
}

export type Parametros = { i: string; f: Finalidade; x: string; s: string }

/**
 * Parâmetros de um link válido por `dias`. `agora` existe para o script de
 * conferência; quem chama no app não passa.
 */
export function assinar(inscricaoId: string, email: string, finalidade: Finalidade, dias: number, agora = Date.now()): Parametros | null {
  const segredo = SEGREDO()
  if (!segredo || !UUID.test(inscricaoId) || !email.trim()) return null
  const expira = Math.floor(agora / 1000) + Math.round(dias * 86_400)
  return { i: inscricaoId, f: finalidade, x: String(expira), s: assinatura(segredo, inscricaoId, email, finalidade, expira) }
}

/**
 * O id que o link diz carregar, ainda sem conferir nada — serve só para
 * buscar o e-mail atual da inscrição, que `verificar` precisa.
 */
export function idDoLink(p: Record<string, string | null | undefined>) {
  return p.i && UUID.test(p.i) ? p.i : null
}

export type Verificacao =
  | { ok: true; inscricaoId: string; finalidade: Finalidade }
  | { ok: false; motivo: 'sem_segredo' | 'malformado' | 'expirado' | 'assinatura' }

/** Confere um link recebido contra o e-mail atual da inscrição. Comparação em tempo constante. */
export function verificar(p: Record<string, string | null | undefined>, email: string | null, agora = Date.now()): Verificacao {
  const segredo = SEGREDO()
  if (!segredo) return { ok: false, motivo: 'sem_segredo' }

  const { i, f, x, s } = p
  if (!i || !f || !x || !s || !UUID.test(i) || !(FINALIDADES as readonly string[]).includes(f) || !/^\d{1,12}$/.test(x)) {
    return { ok: false, motivo: 'malformado' }
  }

  if (!email?.trim()) return { ok: false, motivo: 'assinatura' }
  const esperada = Buffer.from(assinatura(segredo, i, email, f as Finalidade, Number(x)))
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
