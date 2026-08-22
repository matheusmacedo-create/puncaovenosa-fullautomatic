import { Section, SectionTitle } from '@/components/section'
import { Accordion, type AccordionItem } from '@/components/accordion'
import { courseData, formatBRL, institutionContact, SCHOOL_NAME } from '@/lib/course-data'

/**
 * FAQ consolidado: única lista de perguntas da página.
 * Todas as respostas são declarativas e nenhuma promete data, teste
 * prático ou habilitação legal.
 */
export function FAQSection() {
  const items: AccordionItem[] = [
    {
      question: 'Como a data da minha turma será definida?',
      answer:
        'Depois do pagamento da matrícula, você informa os dias e horários disponíveis. A secretaria organiza as turmas semanalmente e entra em contato para confirmar uma opção compatível.',
    },
    {
      question: `O pagamento de ${formatBRL(courseData.registrationPrice)} confirma uma data?`,
      answer:
        'O pagamento inicia sua matrícula, mas não confirma automaticamente uma data. A confirmação é feita pela secretaria.',
    },
    {
      question: 'O que acontece depois do pagamento?',
      answer:
        'Você preenche o formulário de disponibilidade. Depois, a secretaria analisa as informações e entra em contato com os próximos passos.',
    },
    {
      question: 'O curso possui teste prático em aula?',
      answer:
        'Não. A formação não prevê teste prático em aula. O conteúdo presencial é voltado à compreensão da técnica, dos materiais, da biossegurança e da prevenção de complicações, preparando o participante para reconhecer melhor as etapas e os cuidados encontrados na rotina.',
    },
    {
      question: 'O curso me habilita a realizar o procedimento?',
      answer:
        'O curso complementa conhecimentos, mas não substitui formação profissional, registro, habilitação legal ou protocolos institucionais.',
    },
    {
      question: 'Quem pode fazer?',
      answer: `O curso é indicado para pessoas interessadas em ampliar conhecimentos relacionados à punção venosa. A escolaridade mínima informada é ${courseData.prerequisite}.`,
    },
    {
      question: 'Recebo certificado?',
      answer: `Sim. O certificado é emitido pela ${SCHOOL_NAME}, com carga horária de ${courseData.duration}.`,
    },
    {
      question: 'Qual é o investimento?',
      answer: `O investimento total é de ${formatBRL(courseData.totalPrice)}: ${formatBRL(
        courseData.registrationPrice,
      )} de matrícula e ${formatBRL(courseData.remainingPrice)} referentes ao curso.`,
    },
    {
      question: `Por que preciso levar ${courseData.foodDonation}?`,
      answer: `O alimento é entregue no dia do curso e destinado às ações sociais da ${courseData.institution}.`,
    },
    {
      question: 'E se meus horários não forem compatíveis?',
      answer: (
        <p>
          A secretaria informará as possibilidades disponíveis e orientará os próximos passos. Você
          pode falar diretamente com a equipe pelo WhatsApp{' '}
          <a
            href={institutionContact.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary underline decoration-1 underline-offset-2"
          >
            {institutionContact.whatsappLabel}
          </a>
          .
        </p>
      ),
    },
  ]

  return (
    <Section tone="muted" id="faq" ariaLabelledby="faq-title">
      <SectionTitle id="faq-title" eyebrow="Perguntas frequentes">
        Dúvidas sobre matrícula, turmas e conteúdo
      </SectionTitle>
      <div className="mt-8">
        <Accordion items={items} />
      </div>
    </Section>
  )
}
