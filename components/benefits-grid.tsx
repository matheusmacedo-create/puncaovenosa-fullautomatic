import { Award, BookOpenCheck, CalendarCheck, Layers, ShieldCheck, Stethoscope } from 'lucide-react'
import { Section, SectionTitle } from '@/components/section'
import { SCHOOL_NAME } from '@/lib/course-data'

const benefits = [
  {
    icon: BookOpenCheck,
    title: 'Compreensão mais organizada',
    text: 'Conteúdo apresentado de forma conectada às etapas e aos cuidados da rotina.',
  },
  {
    icon: Layers,
    title: 'Mais familiaridade com materiais',
    text: 'Visão técnica sobre dispositivos, calibres e itens relacionados ao procedimento.',
  },
  {
    icon: ShieldCheck,
    title: 'Atenção à biossegurança',
    text: 'Reforço dos cuidados necessários para reduzir riscos e prevenir complicações.',
  },
  {
    icon: CalendarCheck,
    title: 'Formação em um único dia',
    text: 'Carga horária de 8 horas presenciais.',
  },
  {
    icon: Award,
    title: 'Certificado institucional',
    text: `Emitido pela ${SCHOOL_NAME}.`,
  },
  {
    icon: Stethoscope,
    title: 'Preparação para a rotina',
    text: 'Mais clareza sobre o que observar e compreender no dia a dia dos serviços de saúde.',
  },
]

export function BenefitsGrid() {
  return (
    <Section tone="muted" ariaLabelledby="benefits-title">
      <SectionTitle id="benefits-title" eyebrow="O que o curso oferece">
        Formação institucional com foco na compreensão da técnica
      </SectionTitle>

      <ul className="mt-6 sm:mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {benefits.map(({ icon: Icon, title, text }) => (
          <li key={title} className="rounded-md border border-border bg-background p-5">
            <Icon className="size-5 text-primary" aria-hidden="true" />
            <h3 className="mt-3 text-[15px] font-bold">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">
              {text}
            </p>
          </li>
        ))}
      </ul>
    </Section>
  )
}
