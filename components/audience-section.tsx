import { Section, SectionTitle } from '@/components/section'
import { courseData } from '@/lib/course-data'

export function AudienceSection() {
  const items = [
    'Pessoas interessadas em ampliar conhecimentos relacionados à punção venosa.',
    'Estudantes e profissionais que desejam reforçar fundamentos, materiais, biossegurança e prevenção de complicações.',
    `Escolaridade mínima informada: ${courseData.prerequisite}.`,
  ]

  return (
    <Section tone="muted" ariaLabelledby="audience-title">
      <SectionTitle id="audience-title" eyebrow="Público">
        Para quem quer compreender melhor a rotina da punção venosa
      </SectionTitle>

      <ul className="mt-6 sm:mt-8 grid gap-3 md:grid-cols-3">
        {items.map((item) => (
          <li
            key={item}
            className="rounded-md border border-border bg-background p-5 text-[15px] leading-relaxed text-pretty"
          >
            {item}
          </li>
        ))}
      </ul>

      <p className="mt-6 border-l-2 border-primary/40 pl-4 text-sm leading-relaxed text-muted-foreground text-pretty">
        O curso complementa conhecimentos e não substitui formação profissional, registro,
        habilitação legal ou protocolos da instituição em que o participante atua.
      </p>
    </Section>
  )
}
