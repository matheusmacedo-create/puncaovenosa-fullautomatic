'use client'

import { useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { courseData, CTA_LABEL } from '@/lib/course-data'
import {
  buildCheckoutUrl,
  trackCtaClick,
  trackInitiateCheckout,
  type CtaPosition,
} from '@/lib/checkout'
import { useCheckoutOverlay } from '@/components/checkout-overlay'

type CtaButtonProps = {
  position: CtaPosition
  label?: string
  className?: string
  size?: 'default' | 'compact'
  showArrow?: boolean
}

/**
 * Todos os CTAs apontam para a URL real de matrícula, preservando UTMs e a
 * variante do teste. Enquanto `checkoutUrl` não estiver configurada, o botão
 * permanece desabilitado em vez de navegar para "#".
 */
export function CtaButton({
  position,
  label = CTA_LABEL,
  className,
  size = 'default',
  showArrow = true,
}: CtaButtonProps) {
  const [pressed, setPressed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const checkoutReady = Boolean(courseData.checkoutUrl && courseData.checkoutUrl !== '#')
  const { open } = useCheckoutOverlay()

  function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    trackCtaClick(position)
    trackInitiateCheckout({
      position,
      value: courseData.registrationPrice,
      totalValue: courseData.totalPrice,
      courseName: courseData.courseName,
      metaPixelId: courseData.metaPixelId,
    })

    setPressed(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setPressed(false), 450)

    if (!checkoutReady) {
      event.preventDefault()
      return
    }

    const target = buildCheckoutUrl(courseData.checkoutUrl, position)
    event.currentTarget.href = target

    // Clique com modificador (nova aba/janela) ou botão do meio: mantém a
    // navegação padrão do link. Clique normal: abre a gaveta sobre a página.
    const isModifiedClick = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
    if (isModifiedClick) return

    event.preventDefault()
    open(target)
  }

  const classes = cn(
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary text-center font-semibold tracking-wide text-primary-foreground transition-[background-color,transform,box-shadow] duration-200 hover:bg-primary/90 hover:shadow-md active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary data-[pressed]:scale-[0.97] data-[pressed]:bg-primary/85',
    size === 'default' ? 'px-7 py-4 text-base' : 'px-4 py-3 text-sm',
    className,
  )

  const content = (
    <>
      {label}
      {showArrow && (
        <ArrowRight
          className={cn('size-4 shrink-0 transition-transform duration-200', pressed && 'translate-x-1')}
          aria-hidden="true"
        />
      )}
    </>
  )

  return (
    <a
      href={checkoutReady ? courseData.checkoutUrl : '#'}
      onClick={handleClick}
      data-cta-position={position}
      data-pressed={pressed || undefined}
      aria-disabled={checkoutReady ? undefined : true}
      className={classes}
    >
      {content}
    </a>
  )
}
