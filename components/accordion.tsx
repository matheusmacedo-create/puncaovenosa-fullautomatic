'use client'

import { useId, useState } from 'react'
import { Plus, Minus } from 'lucide-react'

export type AccordionItem = {
  question: string
  answer: React.ReactNode
}

export function Accordion({ items }: { items: AccordionItem[] }) {
  const [open, setOpen] = useState<number | null>(0)
  const baseId = useId()

  return (
    <div className="divide-y divide-border border-y border-border">
      {items.map((item, index) => {
        const isOpen = open === index
        const panelId = `${baseId}-panel-${index}`
        const buttonId = `${baseId}-button-${index}`

        return (
          <div key={item.question}>
            <h3>
              <button
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : index)}
                className="flex w-full items-center justify-between gap-4 py-5 text-left text-base font-semibold text-foreground hover:text-primary"
              >
                <span className="text-pretty">{item.question}</span>
                {isOpen ? (
                  <Minus className="size-5 shrink-0 text-primary" aria-hidden="true" />
                ) : (
                  <Plus className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!isOpen}
              className="pb-6 text-[15px] leading-relaxed text-muted-foreground"
            >
              {item.answer}
            </div>
          </div>
        )
      })}
    </div>
  )
}
