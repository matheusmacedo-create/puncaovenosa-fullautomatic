import { COMPOSICAO_PRECO, PRECO_CENTAVOS, ROTA_INSCRICAO } from '@/lib/enrollment'
import { PIXEL_ID } from '@/lib/pixel-id'

export type InstitutionalIndicator = {
  label: string
  value: string
}

export type CoursePhoto = {
  src: string | null
  alt: string
  caption: string
}

/**
 * Nome institucional obrigatório em toda a copy visível.
 * Abreviações só podem existir em nomes internos de variáveis e arquivos.
 */
export const INSTITUTION_NAME = 'Cruz Vermelha Brasileira do Rio de Janeiro'
export const SCHOOL_NAME = `Escola de Educação e Saúde da ${INSTITUTION_NAME}`

/**
 * Os preços da página vêm da mesma composição que o checkout cobra, e não de
 * números escritos aqui. Anunciar um valor e cobrar outro é o pior defeito
 * possível numa página de venda — e era o que aconteceria com o preço de
 * teste ligado: a landing prometeria R$ 249 e a cobrança sairia por centavos.
 */
const centavosDoItem = (id: string) => COMPOSICAO_PRECO.find(item => item.id === id)?.centavos ?? 0
const emReais = (centavos: number) => centavos / 100

// Sob preço de teste a composição vira um item só; aí a matrícula é o total
// e o restante é zero, que é a leitura honesta do que será cobrado.
const CENTAVOS_MATRICULA = centavosDoItem('matricula') || PRECO_CENTAVOS
const CENTAVOS_CURSO = centavosDoItem('curso')

export const courseData = {
  courseName: 'Curso de Punção Venosa',
  duration: '8 horas',
  format: 'Presencial',
  institution: INSTITUTION_NAME,
  school: SCHOOL_NAME,
  city: 'Rio de Janeiro',
  locationLabel: 'Centro do Rio de Janeiro',
  registrationPrice: emReais(CENTAVOS_MATRICULA),
  remainingPrice: emReais(CENTAVOS_CURSO),
  totalPrice: emReais(PRECO_CENTAVOS),
  prerequisite: 'Ensino Médio',
  foodDonation: '1 kg de alimento não perecível',
  paymentMethods: 'PIX ou cartão',
  // Rota deste mesmo app: o checkout deixou de ser outro domínio quando as
  // duas partes viraram um projeto só.
  checkoutUrl: ROTA_INSCRICAO,
  /**
   * Só exibir capacidade quando confirmada oficialmente pela secretaria.
   * Enquanto for null, nenhuma contagem de vagas aparece na página.
   */
  maxSeatsPerClass: null as number | null,
  metaPixelId: PIXEL_ID,
  privacyPolicyUrl: '/politica-de-privacidade' as string | null,
  refundPolicyUrl: '/politica-de-reembolso' as string | null,
  institutionalIndicators: [] as InstitutionalIndicator[],
}

export type CourseData = typeof courseData

/** Dados da sede institucional onde o curso acontece. */
export const institutionContact = {
  siteUrl: 'https://cruzvermelhariodejaneiro.org/',
  addressLines: ['Praça da Cruz Vermelha, 10', 'Centro – Rio de Janeiro – RJ', 'CEP 20230-130'],
  addressShort: 'Praça da Cruz Vermelha, 10 – Centro – Rio de Janeiro – RJ',
  mapsUrl:
    'https://www.google.com/maps/search/?api=1&query=Pra%C3%A7a+da+Cruz+Vermelha%2C+10+-+Centro%2C+Rio+de+Janeiro+-+RJ',
  whatsappLabel: '(21) 99992-2864',
  whatsappUrl:
    'https://wa.me/5521999922864?text=' +
    encodeURIComponent(
      `Olá! Tenho uma dúvida sobre o ${'Curso de Punção Venosa'} da ${INSTITUTION_NAME}.`,
    ),
  email: 'contato@cruzvermelhariodejaneiro.org',
  instagramUrl: 'https://www.instagram.com/cruzvermelhabrasileirarj/',
  facebookUrl: 'https://www.facebook.com/profile.php?id=61591390052128',
  principles:
    'Humanidade, imparcialidade, neutralidade, independência, voluntariado, unidade e universalidade.',
}

/**
 * Imagem do primeiro bloco: punção realizada em braço de simulação.
 * A legenda a identifica como ilustrativa e a copy ao redor não promete
 * prática do aluno — a imagem representa apenas o tema do curso.
 */
export const heroPhoto: CoursePhoto = {
  src: '/fotos/imagem-05-1080.webp',
  alt: 'Punção venosa sendo demonstrada em um braço de simulação sobre a mesa de uma sala de aula',
  caption: 'Imagem ilustrativa.',
}

/**
 * Imagem única da seção de conteúdo. Não é um registro real de aula,
 * por isso a legenda a identifica explicitamente como ilustrativa.
 */
export const contentPhoto: CoursePhoto = {
  src: '/fotos/imagem-06-1080.webp',
  alt: `Instrutor apresentando materiais de punção venosa em sala de aula da ${INSTITUTION_NAME}`,
  caption: 'Imagem ilustrativa do ambiente de aprendizagem.',
}

export const isDev = process.env.NODE_ENV !== 'production'

/**
 * Sem centavos quando o valor é redondo — "R$ 99" lê melhor que "R$ 99,00"
 * numa headline. Com centavos quando existem, senão o preço de teste
 * apareceria como "R$ 0".
 */
export function formatBRL(value: number) {
  const casas = Number.isInteger(value) ? 0 : 2
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })
}

/** Linha de preço padronizada, exibida antes de qualquer clique. */
export const priceLine = [
  `${formatBRL(courseData.registrationPrice)} na matrícula`,
  // Sob preço de teste a composição pode ser um item só: aí não há parcela
  // do curso a anunciar.
  courseData.remainingPrice > 0 ? `${formatBRL(courseData.remainingPrice)} do curso` : null,
  `Total ${formatBRL(courseData.totalPrice)}`,
]
  .filter(Boolean)
  .join(' • ')

export const supportLine = `${courseData.paymentMethods} • ${courseData.foodDonation}`

export const CTA_LABEL = `FAZER MINHA MATRÍCULA POR ${formatBRL(courseData.registrationPrice)}`
