'use client'

import { Mail, MapPin } from 'lucide-react'
import { Section, SectionTitle } from '@/components/section'
import { WhatsappIcon } from '@/components/brand-icons'
import { institutionContact, INSTITUTION_NAME } from '@/lib/course-data'
import { trackFooterContactClick } from '@/lib/checkout'

export function LocationSection() {
  return (
    <Section tone="muted" ariaLabelledby="location-title">
      <SectionTitle id="location-title" eyebrow="Local e contato">
        O curso acontece na sede da {INSTITUTION_NAME}
      </SectionTitle>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-border bg-background p-6">
          <MapPin className="size-5 text-primary" aria-hidden="true" />
          <h3 className="mt-3 text-base font-bold">Endereço</h3>
          <address className="mt-2 text-[15px] leading-relaxed not-italic">
            {institutionContact.addressLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </address>
          <a
            href={institutionContact.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackFooterContactClick('maps')}
            className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Abrir localização no Google Maps
          </a>
        </div>

        <div className="rounded-md border border-border bg-background p-6">
          <WhatsappIcon className="size-5 text-primary" />
          <h3 className="mt-3 text-base font-bold">Contato para cursos</h3>
          <ul className="mt-2 flex flex-col gap-1">
            <li>
              <a
                href={institutionContact.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackFooterContactClick('whatsapp')}
                className="inline-flex min-h-11 items-center gap-2 text-[15px] leading-relaxed transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                WhatsApp: {institutionContact.whatsappLabel}
              </a>
            </li>
            <li>
              <a
                href={`mailto:${institutionContact.email}`}
                onClick={() => trackFooterContactClick('email')}
                className="inline-flex min-h-11 items-center gap-2 break-all text-[15px] leading-relaxed transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <Mail className="size-4 shrink-0 text-primary" aria-hidden="true" />
                {institutionContact.email}
              </a>
            </li>
          </ul>
        </div>
      </div>
    </Section>
  )
}
