'use client'

import { LogoInstitucional } from '@/components/logo-institucional'
import { Mail, MapPin } from 'lucide-react'
import { FacebookIcon, InstagramIcon, WhatsappIcon } from '@/components/brand-icons'
import { IdentificacaoDoVendedor, LinksLegais } from '@/components/links-legais'
import { PendingInfo } from '@/components/pending-info'
import { courseData, institutionContact } from '@/lib/course-data'
import { trackFooterContactClick } from '@/lib/checkout'

const columnTitle = 'text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground'
const contactLink =
  'flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground transition-colors hover:text-primary'

export function InstitutionalFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t-2 border-primary bg-background">
      <div className="mx-auto w-full max-w-[1120px] px-5 py-12 sm:px-8">
        <div className="flex flex-col gap-10 md:grid md:grid-cols-2 md:gap-10 lg:grid-cols-[1fr_0.8fr_1.25fr_0.7fr]">
          {/* Instituição */}
          <div className="order-1">
            <LogoInstitucional alt={courseData.institution} className="h-10 w-auto" />
            <p className="mt-4 max-w-[250px] text-xs leading-relaxed text-muted-foreground">
              {institutionContact.principles}
            </p>
          </div>

          {/* Contato — antes de "Sobre" no mobile */}
          <div className="order-2 lg:order-3">
            <h2 className={columnTitle}>Contato</h2>
            <ul className="mt-4 flex flex-col gap-3">
              <li>
                <a
                  href={institutionContact.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={contactLink}
                  onClick={() => trackFooterContactClick('maps')}
                >
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>
                    {institutionContact.addressLines.map((line, index) => (
                      <span key={line} className={index === 0 ? undefined : 'block'}>
                        {line}
                      </span>
                    ))}
                  </span>
                </a>
              </li>
              <li>
                <a
                  href={institutionContact.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={contactLink}
                  onClick={() => trackFooterContactClick('whatsapp')}
                >
                  <WhatsappIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>
                    {institutionContact.whatsappLabel}
                    <span className="block text-xs">WhatsApp da secretaria de cursos</span>
                  </span>
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${institutionContact.email}`}
                  className={`${contactLink} break-all`}
                  onClick={() => trackFooterContactClick('email')}
                >
                  <Mail className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>{institutionContact.email}</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Sobre */}
          <div className="order-3 lg:order-2">
            <h2 className={columnTitle}>Sobre</h2>
            <p className="mt-4 text-sm leading-relaxed">
              <a
                href={institutionContact.siteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground transition-colors hover:text-primary"
              >
                {courseData.institution}
              </a>
            </p>
          </div>

          {/* Redes sociais */}
          <div className="order-4">
            <h2 className={columnTitle}>Siga-nos</h2>
            <div className="mt-4 flex items-center gap-3">
              <a
                href={institutionContact.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Instagram da ${courseData.institution}`}
                className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                onClick={() => trackFooterContactClick('instagram')}
              >
                <InstagramIcon className="size-5" />
              </a>
              <a
                href={institutionContact.facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Facebook da ${courseData.institution}`}
                className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                onClick={() => trackFooterContactClick('facebook')}
              >
                <FacebookIcon className="size-5" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Barra inferior: quem vende (Decreto nº 7.962/2013, art. 2º) e os documentos legais. */}
      <div className="border-t border-border bg-muted">
        <div className="mx-auto flex w-full max-w-[1120px] flex-col items-center gap-3 px-5 pb-24 pt-4 text-center text-xs text-muted-foreground sm:px-8 sm:pb-4 md:flex-row md:items-start md:justify-between md:gap-8 md:text-left">
          <div className="space-y-1">
            <p>© {year} Cruz Vermelha Brasileira do Rio de Janeiro</p>
            <IdentificacaoDoVendedor className="leading-relaxed [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-primary" />
          </div>
          <div className="flex flex-col items-center gap-1 md:items-end">
            {!courseData.privacyPolicyUrl && (
              <PendingInfo>
                Política de Privacidade oculta: sem página válida publicada ainda
              </PendingInfo>
            )}
            <LinksLegais className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 md:justify-end [&_a]:underline [&_a]:underline-offset-4 [&_a]:transition-colors [&_a:hover]:text-primary" />
          </div>
        </div>
      </div>
    </footer>
  )
}
