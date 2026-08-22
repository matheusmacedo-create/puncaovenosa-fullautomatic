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
    headline: 'Curso de Punção Venosa',
    institutionalLine: `Formação presencial da ${INSTITUTION_NAME}.`,
    subheadline:
      'Em 8 horas, você compreende os fundamentos da técnica, os materiais, a biossegurança e a prevenção de complicações para chegar mais preparado à rotina dos serviços de saúde.',
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
