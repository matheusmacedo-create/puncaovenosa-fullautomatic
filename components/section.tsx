import { cn } from '@/lib/utils'

export function Section({
  children,
  className,
  tone = 'white',
  id,
  ariaLabelledby,
}: {
  children: React.ReactNode
  className?: string
  tone?: 'white' | 'muted' | 'dark'
  id?: string
  ariaLabelledby?: string
}) {
  return (
    <section
      id={id}
      aria-labelledby={ariaLabelledby}
      className={cn(
        'px-5 py-16 sm:px-8 md:py-24',
        tone === 'muted' && 'bg-muted',
        tone === 'dark' && 'bg-foreground text-background',
        className,
      )}
    >
      <div className="mx-auto w-full max-w-5xl">{children}</div>
    </section>
  )
}

export function SectionTitle({
  children,
  id,
  className,
  eyebrow,
}: {
  children: React.ReactNode
  id?: string
  className?: string
  eyebrow?: string
}) {
  return (
    <div className={cn('max-w-3xl', className)}>
      {eyebrow && (
        <p className="mb-3 text-xs font-semibold tracking-[0.18em] text-primary uppercase">
          {eyebrow}
        </p>
      )}
      <h2
        id={id}
        className="text-balance text-2xl font-bold leading-tight sm:text-3xl md:text-[2.1rem]"
      >
        {children}
      </h2>
    </div>
  )
}
