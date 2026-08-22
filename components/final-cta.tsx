import { CtaButton } from '@/components/cta-button'
import { priceLine, supportLine } from '@/lib/course-data'

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
          Comece sua matrícula agora. A data da turma é combinada depois.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-[15px] leading-relaxed text-muted-foreground sm:text-base">
          Após o pagamento da matrícula, você informa os dias e horários que funcionam melhor. A
          secretaria analisa as disponibilidades e entra em contato para confirmar sua turma e
          orientar os próximos passos.
        </p>

        <div className="mt-8">
          <CtaButton position="final" className="w-full sm:w-auto" />
          <p className="mt-3 text-sm font-semibold">{priceLine}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">{supportLine}</p>
        </div>
      </div>
    </section>
  )
}
