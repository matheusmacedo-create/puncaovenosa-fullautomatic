import { createHash, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

/**
 * Acesso ao painel da secretaria.
 *
 * O painel lista nome, CPF e telefone de alunos reais, então não pode ser
 * público. Também não vale a pena montar contas e login para isso: quem usa
 * são as pessoas da secretaria, e a página é uma janela de leitura provisória
 * até a integração com os sistemas deles existir. Uma senha compartilhada,
 * guardada no ambiente, é a proporção certa.
 *
 * Sem `SECRETARIA_SENHA` definida, a rota inteira responde 404 — não existe
 * painel para invadir num deploy que não pediu por ele.
 */

export const COOKIE_SECRETARIA = 'cvb_secretaria'

const OITO_HORAS = 60 * 60 * 8

/**
 * Senha curta em página exposta na internet é senha adivinhada: não há como
 * limitar tentativas sem um lugar para contá-las, então a defesa possível é
 * exigir que ela seja longa. Abaixo disso o painel simplesmente não liga, e o
 * diagnóstico explica por quê.
 */
export const TAMANHO_MINIMO_DA_SENHA = 16

export function senhaDaSecretaria(): string | null {
  const senha = process.env.SECRETARIA_SENHA?.trim()
  if (!senha || senha.length < TAMANHO_MINIMO_DA_SENHA) return null
  return senha
}

export function secretariaHabilitada() {
  return senhaDaSecretaria() !== null
}

/** Motivo legível para o diagnóstico, sem devolver a senha. */
export function estadoDaSecretaria() {
  const bruta = process.env.SECRETARIA_SENHA?.trim()
  if (!bruta) return { habilitada: false, motivo: 'SECRETARIA_SENHA não definida' }
  if (bruta.length < TAMANHO_MINIMO_DA_SENHA) {
    return { habilitada: false, motivo: `SECRETARIA_SENHA tem menos de ${TAMANHO_MINIMO_DA_SENHA} caracteres` }
  }
  return { habilitada: true, motivo: null }
}

/**
 * O cookie guarda o hash da senha, não a senha. Não é proteção contra quem
 * rouba o cookie — esse já entrou —, mas evita que o segredo em claro fique
 * escrito no navegador de cada pessoa da secretaria.
 */
function marca(senha: string) {
  return createHash('sha256').update(senha).digest('hex')
}

function iguais(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export function senhaConfere(tentativa: string) {
  const senha = senhaDaSecretaria()
  if (!senha) return false
  return iguais(marca(tentativa), marca(senha))
}

export async function secretariaAutenticada() {
  const senha = senhaDaSecretaria()
  if (!senha) return false
  const valor = (await cookies()).get(COOKIE_SECRETARIA)?.value
  return Boolean(valor) && iguais(valor!, marca(senha))
}

export async function abrirSessaoDaSecretaria() {
  const senha = senhaDaSecretaria()
  if (!senha) return
  ;(await cookies()).set(COOKIE_SECRETARIA, marca(senha), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: OITO_HORAS,
  })
}

export async function fecharSessaoDaSecretaria() {
  ;(await cookies()).delete(COOKIE_SECRETARIA)
}
