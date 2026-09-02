import { MessageCircle, ShieldCheck } from 'lucide-react'
import { courseData, institutionContact, priceLine } from '@/lib/course-data'

/**
 * O que fica logo abaixo de cada CTA: preço, garantia e uma porta de saída
 * humana.
 *
 * A garantia existia só como link no rodapé, longe de onde a decisão
 * acontece — não é promessa de marketing, é a política publicada em
 * `/politica-de-reembolso`. O WhatsApp entra pelo mesmo motivo: parte do
 * público não compra sem falar com uma pessoa antes.
 *
 * Tudo isso cabe em duas linhas de propósito. A primeira versão empilhava
 * quatro blocos com ícone e frase inteira, e o resultado eram seis linhas de
 * letra miúda coladas embaixo do botão em quatro pontos da página: lido de
 * longe virava um rodapé de contrato, e um bloco de termos logo abaixo do
 * botão trabalha contra ele. A doação de alimento saiu daqui (continua no
 * quadro de oferta e no FAQ) porque é a informação menos urgente das três no
 * momento de decidir.
 */
export function CtaReassurance({ showPrice = true, centralizado = false }: {
  /** Desligue onde o preço já está escrito logo acima, como no quadro de oferta. */
  showPrice?: boolean
  /** Acompanha um CTA centralizado, como o do fim da página. */
  centralizado?: boolean
}) {
  return (
    <div className={`mt-3 ${centralizado ? 'text-center' : ''}`}>
      {showPrice && <p className="text-sm font-semibold">{priceLine}</p>}

      <p className={`mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[13px] leading-tight text-muted-foreground ${centralizado ? 'justify-center' : ''}`}>
        <span>{courseData.paymentMethods}</span>

        <span aria-hidden="true" className="text-border">•</span>

        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
          {courseData.refundPolicyUrl ? (
            <a
              href={courseData.refundPolicyUrl}
              className="font-semibold text-foreground underline decoration-1 underline-offset-2"
            >
              Garantia de {courseData.refundWindowDays} dias
            </a>
          ) : (
            <span className="font-semibold text-foreground">
              Garantia de {courseData.refundWindowDays} dias
            </span>
          )}
        </span>

        <span aria-hidden="true" className="text-border">•</span>

        <span className="inline-flex items-center gap-1.5">
          <MessageCircle className="size-4 shrink-0 text-primary" aria-hidden="true" />
          Dúvidas no WhatsApp{' '}
          <a
            href={institutionContact.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary underline decoration-1 underline-offset-2"
          >
            {institutionContact.whatsappLabel}
          </a>
        </span>
      </p>
    </div>
  )
}
