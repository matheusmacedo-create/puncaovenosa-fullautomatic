import { createHash } from 'node:crypto'
import { digits } from '@/lib/enrollment'

/**
 * Hash compartilhado entre a Conversions API (`lib/meta-capi.ts`) e a
 * sincronização de público de remarketing (`lib/meta-audiencia.ts`) — as
 * duas mandam PII ao Meta e precisam bater no mesmo formato, senão o mesmo
 * telefone hashado de dois jeitos diferentes vira duas pessoas para o Meta.
 */

/** Hash sempre em minúsculo e sem espaço nas pontas — é a exigência do Meta. */
export const hash = (valor: string) => createHash('sha256').update(valor.trim().toLowerCase()).digest('hex')

// Acento derruba a correspondência por cidade ("São Paulo" x "Sao Paulo") —
// o Meta pede o texto normalizado antes do hash, e só para cidade isso
// costuma variar entre as fontes.
export const semAcentos = (valor: string) => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/**
 * Telefone no formato que o Meta exige para hash: só dígitos, com código do
 * país na frente, sem `+`. `telefone` na tabela `inscricoes` é gravado sem
 * o "55" (só DDD + número, 11 dígitos) — mandar esses 11 dígitos direto pro
 * hash nunca bate com o telefone que o próprio Meta coletou em outro lugar
 * já com o país. Único mercado atendido é o Brasil, então o prefixo é fixo.
 */
export function telefoneInternacional(telefone: string) {
  const d = digits(telefone)
  return d.startsWith('55') ? d : `55${d}`
}

export function nomeESobrenome(nomeCompleto: string) {
  const [primeiro, ...resto] = nomeCompleto.trim().split(/\s+/)
  return { primeiro, sobrenome: resto.join(' ') || null }
}
