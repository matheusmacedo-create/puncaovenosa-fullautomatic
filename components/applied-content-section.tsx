import { AlertTriangle, ListChecks, Package } from 'lucide-react'
import { CtaButton } from '@/components/cta-button'
import { Foto } from '@/components/foto'
import { CtaReassurance } from '@/components/cta-reassurance'
import { contentPhoto, courseData, formatBRL } from '@/lib/course-data'

const highlights = [
  {
    icon: ListChecks,
    title: 'Entenda cada etapa',
    text: 'Compreenda a lógica e os cuidados envolvidos no procedimento.',
  },
  {
    icon: Package,
    title: 'Reconheça materiais e dispositivos',
    text: 'Amplie sua familiaridade com os itens utilizados na rotina.',
  },
  {
    icon: AlertTriangle,
    title: 'Antecipe riscos',
    text: 'Conheça cuidados de biossegurança e situações que exigem atenção.',
  },
]

export function AppliedContentSection() {
  return (
    <section aria-labelledby="content-title" className="bg-muted px-5 py-16 sm:px-8 md:py-24">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-10 md:flex-row md:items-center md:gap-14">
        <figure className="md:w-[44%] md:shrink-0">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md bg-background md:aspect-[4/5]">
            <Foto foto={contentPhoto} sizes="(max-width: 768px) 100vw, 480px" className="object-cover" />
          </div>
          <figcaption className="mt-2 text-xs text-muted-foreground">
            {contentPhoto.caption}
          </figcaption>
        </figure>

        <div className="md:flex-1">
          <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">
            Conhecimento aplicado
          </p>
          <h2
            id="content-title"
            className="mt-3 text-balance text-2xl font-bold leading-tight sm:text-3xl md:text-[2.1rem]"
          >
            Conteúdo técnico para você chegar mais preparado à rotina.
          </h2>

          <p className="mt-5 max-w-[55ch] text-[15px] leading-relaxed text-muted-foreground">
            Ao longo das {courseData.duration}, o curso aborda a técnica, os materiais, a
            biossegurança e a prevenção de complicações com foco na compreensão do que faz parte do
            dia a dia da punção venosa.
          </p>

          <ul className="mt-8 flex flex-col gap-5">
            {highlights.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <Icon
                  className="mt-0.5 size-[18px] shrink-0 text-primary"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <div>
                  <h3 className="text-[15px] font-bold">{title}</h3>
                  <p className="mt-1 max-w-[55ch] text-sm leading-relaxed text-muted-foreground text-pretty">
                    {text}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-10 rounded-md border border-primary/20 border-l-[3px] border-l-primary bg-primary/5 p-6">
            <h3 className="text-balance text-lg font-bold sm:text-xl">
              Dê o primeiro passo para participar de uma turma
            </h3>
            <p className="mt-2 max-w-[55ch] text-sm leading-relaxed text-muted-foreground">
              Faça sua matrícula por {formatBRL(courseData.registrationPrice)}. Depois do pagamento,
              você informa os dias e horários que funcionam melhor para participar.
            </p>

            <CtaButton
              position="content"
              label={`INICIAR MATRÍCULA POR ${formatBRL(courseData.registrationPrice)}`}
              className="mt-5 w-full sm:w-auto"
            />

            <CtaReassurance compact />
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              A data e o horário serão confirmados pela secretaria após a organização da turma.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
