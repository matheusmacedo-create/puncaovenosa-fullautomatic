import { InstitutionalHeader } from '@/components/institutional-header'
import { InstitutionalFooter } from '@/components/institutional-footer'

/** Moldura comum às páginas de texto legal (privacidade, reembolso). */
export function LegalPage({
  title,
  updatedAt,
  children,
}: {
  title: string
  updatedAt: string
  children: React.ReactNode
}) {
  return (
    <>
      <InstitutionalHeader />
      <main className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última atualização em {updatedAt}.</p>
        <div className="mt-10 space-y-8">{children}</div>
      </main>
      <InstitutionalFooter />
    </>
  )
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-bold text-foreground sm:text-lg">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground sm:text-base">{children}</div>
    </section>
  )
}

export const legalList = 'list-disc space-y-1.5 pl-5'
