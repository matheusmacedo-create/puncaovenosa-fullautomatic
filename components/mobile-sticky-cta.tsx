'use client'

import { useEffect, useState } from 'react'
import { CtaButton } from '@/components/cta-button'
import { courseData, formatBRL } from '@/lib/course-data'

export function MobileStickyCTA() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const hero = document.getElementById('hero-title')
    const finalCta = document.getElementById('cta-final')

    let pastHero = false
    let finalVisible = false

    const update = () => setVisible(pastHero && !finalVisible)

    const heroObserver = new IntersectionObserver(
      ([entry]) => {
        pastHero = !entry.isIntersecting
        update()
      },
      { threshold: 0 },
    )

    const finalObserver = new IntersectionObserver(
      ([entry]) => {
        finalVisible = entry.isIntersecting
        update()
      },
      { threshold: 0.2 },
    )

    if (hero) heroObserver.observe(hero)
    if (finalCta) finalObserver.observe(finalCta)

    return () => {
      heroObserver.disconnect()
      finalObserver.disconnect()
    }
  }, [])

  return (
    <div
      aria-hidden={!visible}
      className={`fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/98 backdrop-blur transition-transform duration-200 md:hidden ${
        visible ? 'translate-y-0' : 'pointer-events-none translate-y-full'
      }`}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="leading-tight">
          <p className="text-sm font-bold">
            Matrícula {formatBRL(courseData.registrationPrice)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Total {formatBRL(courseData.totalPrice)}
          </p>
        </div>
        <CtaButton
          position="sticky"
          label="FAZER MATRÍCULA"
          size="compact"
          showArrow={false}
          className="shrink-0"
        />
      </div>
    </div>
  )
}
