'use client'

import Image from 'next/image'
import { CalendarRange, Clock3, MapPin } from 'lucide-react'
import { CtaButton } from '@/components/cta-button'
import { courseData, heroPhoto, priceLine, supportLine } from '@/lib/course-data'
import { classFormationNote, heroCopy } from '@/lib/headlines'
import type { Variant } from '@/lib/ab-test'

const cards = [
  {
    icon: CalendarRange,
    label: 'Formação das turmas',
    value: 'Organizadas semanalmente',
  },
  {
    icon: Clock3,
    label: 'Disponibilidade',
    value: 'Informada depois da matrícula',
  },
  {
    icon: MapPin,
    label: 'Local',
    value: courseData.locationLabel,
  },
]

export function HeroSection({ variant }: { variant: Variant }) {
  const copy = heroCopy[variant]

  return (
    <section
      className="border-b border-border px-5 py-12 sm:px-8 md:py-16"
      aria-labelledby="hero-title"
    >
      <div className="mx-auto w-full max-w-[1120px] lg:grid lg:grid-cols-[minmax(0,1fr)_40%] lg:gap-x-14">
        <div className="lg:col-start-1 lg:row-start-1">
          <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">
            {copy.kicker}
          </p>

          <h1
            id="hero-title"
            className="mt-4 text-balance text-[1.75rem] font-bold leading-[1.15] sm:text-4xl md:text-[2.6rem]"
          >
            {copy.headline}
          </h1>

          {copy.institutionalLine ? (
            <p className="mt-4 text-pretty text-base font-semibold text-foreground sm:text-lg">
              {copy.institutionalLine}
            </p>
          ) : null}

          <p className="mt-5 max-w-2xl text-pretty text-[15px] leading-relaxed text-muted-foreground sm:text-base">
            {copy.subheadline}
          </p>
        </div>

        <figure className="mt-8 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0 lg:self-center">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md bg-muted sm:aspect-[16/10] lg:aspect-[4/5]">
            {heroPhoto.src ? (
              <Image
                src={heroPhoto.src}
                alt={heroPhoto.alt}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 440px"
                className="object-cover"
              />
            ) : null}
          </div>
          <figcaption className="mt-2 text-xs text-muted-foreground">{heroPhoto.caption}</figcaption>
        </figure>

        <div className="lg:col-start-1 lg:row-start-2">
          <dl className="mt-8 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-3">
            {cards.map((card) => (
              <div key={card.label} className="bg-background p-4">
                <dt className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  <card.icon className="size-3.5 shrink-0" aria-hidden="true" />
                  {card.label}
                </dt>
                <dd className="mt-1.5 text-sm font-semibold">{card.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8">
            <CtaButton position="hero" className="w-full sm:w-auto" />
            <p className="mt-3 text-sm font-semibold">{priceLine}</p>
            <p className="mt-1 text-[13px] text-muted-foreground">{supportLine}</p>
          </div>

          <p className="mt-6 max-w-2xl border-l-2 border-primary/40 pl-4 text-[13px] leading-relaxed text-muted-foreground">
            {classFormationNote}
          </p>
        </div>
      </div>
    </section>
  )
}
