import { CtaButton } from '@/components/cta-button'
import { CtaReassurance } from '@/components/cta-reassurance'
import { courseData, formatBRL } from '@/lib/course-data'

export function FinalCTA() {
  return (
    <section
      id="cta-final"
      aria-labelledby="final-cta-title"
      className="border-t border-border px-5 py-16 sm:px-8 md:py-20"
    >
      <div className="mx-auto w-full max-w-3xl text-center">
        <h2
          id="final-cta-title"
          className="text-balance text-2xl font-bold leading-tight sm:text-3xl"
        >
          Garanta sua vaga hoje por {formatBRL(courseData.registrationPrice)}. Os dias e horários você combina depois.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-[15px] leading-relaxed text-muted-foreground sm:text-base">
          Quem trabalha em escala não consegue marcar curso com meses de antecedência. Por isso a
          vaga vem primeiro: depois do pagamento da matrícula você informa os dias e horários que
          funcionam, e a secretaria monta a turma em cima disso.
        </p>

        <div className="mt-8">
          <CtaButton position="final" className="w-full sm:w-auto" />
          <CtaReassurance centralizado />
        </div>
      </div>
    </section>
  )
}
