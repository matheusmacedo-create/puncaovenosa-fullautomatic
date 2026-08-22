import { isDev } from '@/lib/course-data'
import { cn } from '@/lib/utils'

/**
 * Etiqueta discreta exibida apenas em desenvolvimento.
 * Em produção o elemento simplesmente não é renderizado.
 */
export function PendingInfo({
  children = 'Informação pendente',
  className,
}: {
  children?: React.ReactNode
  className?: string
}) {
  if (!isDev) return null

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded border border-dashed border-primary/40 bg-primary/5 px-2 py-0.5 text-[11px] font-medium tracking-wide text-primary/90 uppercase',
        className,
      )}
    >
      {children}
    </span>
  )
}

/**
 * Faixa compacta que substitui uma seção inteira ainda sem dados,
 * evitando blocos e quadros vazios na página. Invisível em produção.
 */
export function PendingSectionNotice({ children }: { children: React.ReactNode }) {
  if (!isDev) return null

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-4 sm:px-8">
      <PendingInfo>{children}</PendingInfo>
    </div>
  )
}

/** Valor confirmado ou etiqueta de pendência (com texto neutro em produção). */
export function DataValue({
  value,
  fallback,
  pendingLabel,
}: {
  value: string | number | null | undefined
  fallback?: string
  pendingLabel?: string
}) {
  if (value !== null && value !== undefined && value !== '') {
    return <>{value}</>
  }
  if (isDev) return <PendingInfo>{pendingLabel ?? 'Informação pendente'}</PendingInfo>
  if (fallback) return <>{fallback}</>
  return null
}
