import { INSTITUTION_NAME } from '@/lib/course-data'

export type HeroCopy = {
  kicker: string
  headline: string
  institutionalLine: string | null
  subheadline: string
}

/**
 * A copy do topo da landing.
 *
 * Houve aqui duas versões, escolhidas por `?variant=` e servidas em
 * endereços separados. Nunca chegaram a ser comparadas: o anúncio apontou
 * sempre para a mesma, a segunda ficou sem tráfego, e o aparato de escolha
 * — registro de páginas, cookie, rota `/lp/[slug]`, quebra por variante no
 * painel — continuou custando manutenção em toda mudança de copy. Uma
 * página só, cuidada de verdade, vale mais que duas pela metade.
 *
 * O título não é o nome do curso: quem chega de anúncio decide em segundos,
 * e precisa saber o que ganha e de quem é o certificado antes de rolar.
 */
export const heroCopy: HeroCopy = {
  kicker: 'CURSO PRESENCIAL • 8 HORAS • RIO DE JANEIRO',
  headline: 'Entenda a punção venosa de ponta a ponta em um único dia',
  institutionalLine: `Curso presencial com certificado da ${INSTITUTION_NAME}.`,
  subheadline:
    'São 8 horas sobre a técnica, os materiais, a biossegurança e as complicações que você precisa saber reconhecer — organizadas para você sair com a sequência inteira na cabeça.',
}

export const classFormationNote =
  'Depois do pagamento, você informa os dias e horários que funcionam melhor. A secretaria confirma sua turma e orienta os próximos passos.'
