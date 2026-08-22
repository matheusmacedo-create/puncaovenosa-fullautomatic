import { courseData, institutionContact } from '@/lib/course-data'

/**
 * Dados estruturados apenas com informações confirmadas.
 * Sem EducationEvent: não há data de turma para declarar, já que as turmas
 * são formadas semanalmente pela secretaria. Nenhuma menção a prática
 * supervisionada ou execução do procedimento.
 */
export function StructuredData() {
  const place = {
    '@type': 'Place',
    name: `Sede da ${courseData.institution}`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Praça da Cruz Vermelha, 10',
      addressLocality: courseData.city,
      addressRegion: 'RJ',
      postalCode: '20230-130',
      addressCountry: 'BR',
    },
  }

  const course = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: courseData.courseName,
    description:
      'Curso presencial de Punção Venosa com 8 horas, conteúdo técnico aplicado à rotina e certificado da Cruz Vermelha Brasileira do Rio de Janeiro.',
    provider: {
      '@type': 'EducationalOrganization',
      name: courseData.institution,
      url: institutionContact.siteUrl,
    },
    educationalCredentialAwarded: `Certificado de participação — ${courseData.duration}`,
    coursePrerequisites: courseData.prerequisite,
    offers: {
      '@type': 'Offer',
      price: courseData.totalPrice,
      priceCurrency: 'BRL',
      category: 'Investimento total',
    },
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'Onsite',
      courseWorkload: 'PT8H',
      organizer: {
        '@type': 'EducationalOrganization',
        name: courseData.institution,
      },
      location: place,
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify([course]) }}
    />
  )
}
