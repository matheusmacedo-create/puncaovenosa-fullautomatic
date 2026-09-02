import { Section, SectionTitle } from '@/components/section'

const points = [
  'Estudou o conteúdo, mas ainda tem dificuldade para visualizar a sequência completa.',
  'Quer reconhecer melhor os materiais, dispositivos e cuidados envolvidos.',
  'Precisa reforçar os princípios de biossegurança e prevenção de complicações.',
  'Deseja compreender a técnica com uma visão mais conectada à rotina profissional.',
  'Procura uma formação presencial, concentrada em um único dia e com certificado.',
]

export function PainSection() {
  return (
    <Section tone="muted" ariaLabelledby="pain-title">
      <SectionTitle id="pain-title">
        Se você quer chegar mais preparado ao dia a dia da saúde, este curso pode ajudar
      </SectionTitle>

      <ul className="mt-6 sm:mt-8 grid gap-3 sm:grid-cols-2">
        {points.map((point) => (
          <li
            key={point}
            className="rounded-md border border-border bg-background p-5 text-[15px] leading-relaxed text-pretty"
          >
            {point}
          </li>
        ))}
      </ul>
    </Section>
  )
}
