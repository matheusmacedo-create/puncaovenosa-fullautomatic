import { MessageCircle, ShieldCheck } from 'lucide-react'
import { courseData, institutionContact, priceLine, supportLine } from '@/lib/course-data'

/**
 * O que fica logo abaixo de cada CTA: preço, garantia e uma porta de saída
 * humana.
 *
 * A garantia de arrependimento existia só como link no rodapé, longe de
 * onde a decisão acontece. É o argumento mais forte que a página tem para
 * quem hesita — não é promessa de marketing, é a política publicada em
 * `/politica-de-reembolso` — e por isso passa a aparecer ao lado do botão,
 * em todos os pontos de decisão.
 *
 * O WhatsApp entra pelo mesmo motivo: parte do público não compra sem falar
 * com uma pessoa antes, e sem um canal visível essa gente simplesmente
 * fecha a página.
 */
export function CtaReassurance({ compact = false, showPrice = true }: {
  compact?: boolean
  /** Desligue onde o preço já está escrito logo acima, como no quadro de oferta. */
  showPrice?: boolean
}) {
  return (
    <div className={compact ? 'mt-3' : 'mt-3 sm:mt-4'}>
      {showPrice ? <>
        <p className="text-sm font-semibold">{priceLine}</p>
        <p className="mt-1 text-[13px] text-muted-foreground">{supportLine}</p>
      </> : <p className="text-[13px] text-muted-foreground">{supportLine}</p>}

      <p className="mt-3 flex items-start gap-2 text-[13px] leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>
          <strong className="font-semibold text-foreground">
            {courseData.refundWindowDays} dias de garantia.
          </strong>{' '}
          Desistiu nesse prazo, devolvemos o valor integral —{' '}
          {courseData.refundPolicyUrl ? (
            <a
              href={courseData.refundPolicyUrl}
              className="font-semibold text-primary underline decoration-1 underline-offset-2"
            >
              veja a política
            </a>
          ) : (
            'conforme a política de reembolso'
          )}
          .
        </span>
      </p>

      <p className="mt-2 flex items-start gap-2 text-[13px] leading-relaxed text-muted-foreground">
        <MessageCircle className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span>
          Ficou com dúvida? Fale com a secretaria no WhatsApp{' '}
          <a
            href={institutionContact.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary underline decoration-1 underline-offset-2"
          >
            {institutionContact.whatsappLabel}
          </a>
          .
        </span>
      </p>
    </div>
  )
}
