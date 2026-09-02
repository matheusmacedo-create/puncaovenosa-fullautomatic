import { INSTITUTION_NAME } from '@/lib/course-data'
import type { Variant } from '@/lib/ab-test'

export type HeroCopy = {
  kicker: string
  headline: string
  institutionalLine: string | null
  subheadline: string
}

/**
 * O teste A/B altera apenas o ângulo da mensagem principal do hero.
 * Preço, imagem, layout, CTAs, público e demais seções são idênticos.
 */
export const heroCopy: Record<Variant, HeroCopy> = {
  a: {
    kicker: 'CURSO PRESENCIAL • 8 HORAS • RIO DE JANEIRO',
    // O título era o nome do curso — um rótulo de catálogo. Para quem chega
    // de anúncio e decide em segundos, ele precisa dizer o que a pessoa
    // ganha e por que confiar: a técnica inteira num dia, e o nome da
    // instituição, que é o ativo mais forte desta página.
    headline: 'Entenda a punção venosa de ponta a ponta em um único dia',
    institutionalLine: `Curso presencial com certificado da ${INSTITUTION_NAME}.`,
    subheadline:
      'São 8 horas sobre a técnica, os materiais, a biossegurança e as complicações que você precisa saber reconhecer — organizadas para você sair com a sequência inteira na cabeça.',
  },
  b: {
    kicker: 'CURSO PRESENCIAL • 8 HORAS • RIO DE JANEIRO',
    headline:
      'Você conhece a teoria, mas ainda sente insegurança diante da rotina da punção venosa?',
    institutionalLine: null,
    subheadline: `Compreenda melhor cada etapa, os materiais e os cuidados envolvidos em uma formação presencial da ${INSTITUTION_NAME}.`,
  },
}

export const classFormationNote =
  'Depois do pagamento, você informa os dias e horários que funcionam melhor. A secretaria confirma sua turma e orienta os próximos passos.'
