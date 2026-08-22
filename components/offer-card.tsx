import { Check, HeartHandshake } from 'lucide-react'
import { Section, SectionTitle } from '@/components/section'
import { CtaButton } from '@/components/cta-button'
import { courseData, formatBRL, INSTITUTION_NAME, SCHOOL_NAME } from '@/lib/course-data'

export function OfferCard() {
  const includedItems = [
    `Curso presencial de Punção Venosa com ${courseData.duration}.`,
    'Conteúdo técnico aplicado à rotina.',
    `Certificado da ${SCHOOL_NAME}.`,
    `Formação realizada no ${courseData.locationLabel}.`,
  ]

  return (
    <Section id="oferta" ariaLabelledby="offer-title">
      <SectionTitle id="offer-title" eyebrow="Matrícula">
        O que está incluído
      </SectionTitle>

      <div className="mt-8 grid gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-[1.15fr_1fr]">
        <div className="bg-background p-6 sm:p-8">
          <ul className="grid gap-3">
            {includedItems.map((item) => (
              <li key={item} className="flex items-start gap-3 text-[15px] leading-relaxed">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="text-pretty">{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-7 flex items-start gap-3 rounded-md bg-muted p-4">
            <HeartHandshake className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-pretty">
              Também solicitamos {courseData.foodDonation}, entregue no dia do curso e destinado às
              ações sociais da {INSTITUTION_NAME}.
            </p>
          </div>
        </div>

        <div className="bg-background p-6 sm:p-8">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            Investimento
          </p>

          <dl className="mt-4 flex flex-col gap-px overflow-hidden rounded-md border border-border bg-border">
            <div className="flex items-baseline justify-between gap-4 bg-background px-4 py-3">
              <dt className="text-sm text-muted-foreground">Matrícula</dt>
              <dd className="text-sm font-semibold tabular-nums">
                {formatBRL(courseData.registrationPrice)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 bg-background px-4 py-3">
              <dt className="text-sm text-muted-foreground">Curso de Punção Venosa</dt>
              <dd className="text-sm font-semibold tabular-nums">
                {formatBRL(courseData.remainingPrice)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 bg-muted px-4 py-3">
              <dt className="text-sm font-semibold">Investimento total</dt>
              <dd className="text-lg font-bold tabular-nums">
                {formatBRL(courseData.totalPrice)}
              </dd>
            </div>
          </dl>

          <p className="mt-4 text-sm text-muted-foreground">
            Pagamento: {courseData.paymentMethods}
          </p>

          <CtaButton position="offer" className="mt-6 w-full" />
        </div>
      </div>
    </Section>
  )
}
