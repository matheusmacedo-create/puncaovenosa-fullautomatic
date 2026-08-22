import { Info } from 'lucide-react'
import { Section, SectionTitle } from '@/components/section'
import { courseData, formatBRL } from '@/lib/course-data'

const steps = [
  {
    title: 'Faça sua matrícula',
    text: `Pague ${formatBRL(courseData.registrationPrice)} para iniciar sua matrícula no curso.`,
  },
  {
    title: 'Informe sua disponibilidade',
    text: 'Preencha o formulário com os dias da semana e horários que funcionam melhor.',
  },
  {
    title: 'Organização semanal',
    text: 'A secretaria analisa as disponibilidades e forma turmas com horários compatíveis.',
  },
  {
    title: 'Receba a confirmação',
    text: 'A secretaria entra em contato para confirmar a turma e informar os próximos passos.',
  },
]

export function ClassFormationSection() {
  return (
    <Section ariaLabelledby="formation-title">
      <SectionTitle id="formation-title" eyebrow="Formação das turmas">
        Você informa sua disponibilidade. A secretaria organiza as turmas toda semana.
      </SectionTitle>

      <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted-foreground text-pretty sm:text-base">
        Depois do pagamento da matrícula, você preencherá um formulário indicando os dias da semana e
        horários que funcionam melhor. Toda semana, a secretaria reúne as disponibilidades recebidas
        e organiza as próximas turmas, considerando a compatibilidade de horários e a capacidade
        disponível.
      </p>

      {/* Sequência real do processo: a numeração é load-bearing aqui. */}
      <ol className="mt-8 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-4 bg-background p-5">
            <span className="text-xs font-semibold tabular-nums text-primary">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div>
              <h3 className="text-[15px] font-bold">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">
                {step.text}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex gap-3 rounded-md border border-border bg-muted p-5">
        <Info className="mt-0.5 size-[18px] shrink-0 text-primary" aria-hidden="true" />
        <p className="text-sm leading-relaxed text-pretty">
          O preenchimento da disponibilidade não confirma automaticamente uma data. A data e o
          horário da turma são confirmados pela secretaria.
        </p>
      </div>

      {courseData.maxSeatsPerClass !== null ? (
        <p className="mt-4 text-sm font-semibold">
          Capacidade máxima por turma: {courseData.maxSeatsPerClass} participantes.
        </p>
      ) : null}
    </Section>
  )
}
