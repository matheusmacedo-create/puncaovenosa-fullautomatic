import { Section, SectionTitle } from '@/components/section'

const topics = [
  'Anatomia venosa aplicada.',
  'Materiais e dispositivos utilizados na punção venosa.',
  'Escolha do dispositivo e do calibre.',
  'Etapas e fundamentos da técnica.',
  'Biossegurança e controle de infecções.',
  'Prevenção e reconhecimento de complicações.',
  'Boas práticas relacionadas à rotina dos serviços de saúde.',
]

export function SolutionSection() {
  return (
    <Section ariaLabelledby="solution-title">
      <div className="grid gap-10 md:grid-cols-[1fr_1fr] md:gap-14">
        <div>
          <SectionTitle id="solution-title" eyebrow="Conteúdo aplicado">
            O que você vai compreender ao longo das 8 horas
          </SectionTitle>

          <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-muted-foreground sm:text-base">
            <p className="text-pretty">
              O conteúdo é apresentado de forma conectada, para que você compreenda a lógica da
              técnica, os materiais envolvidos e os cuidados que fazem parte do procedimento.
            </p>
            <p className="text-pretty">
              A formação é presencial, concentrada em um único dia, com certificado emitido ao final.
            </p>
          </div>
        </div>

        <ul className="grid gap-px self-start overflow-hidden rounded-md border border-border bg-border">
          {topics.map((topic) => (
            <li key={topic} className="bg-background px-5 py-4">
              <span className="text-[15px] font-medium text-pretty">{topic}</span>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  )
}
