import { Section, SectionTitle } from '@/components/section'

export function ValueProposition() {
  return (
    <Section ariaLabelledby="value-title">
      <SectionTitle id="value-title" eyebrow="Conhecimento para a rotina">
        Mais clareza para compreender cada etapa da punção venosa.
      </SectionTitle>

      <div className="mt-7 grid gap-5 text-[15px] leading-relaxed text-muted-foreground sm:text-base md:grid-cols-3">
        <p className="text-pretty">
          Conhecer a técnica vai além de decorar uma sequência. É preciso entender os materiais, os
          cuidados de biossegurança e os fatores que influenciam o procedimento.
        </p>
        <p className="text-pretty">
          Também é necessário reconhecer as complicações que precisam ser prevenidas e os sinais que
          exigem atenção durante a rotina dos serviços de saúde.
        </p>
        <p className="text-pretty">
          Em uma formação presencial de 8 horas, o curso organiza esses conhecimentos de forma
          conectada à rotina dos serviços de saúde.
        </p>
      </div>
    </Section>
  )
}
