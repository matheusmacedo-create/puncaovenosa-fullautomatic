import { LogoInstitucional } from '@/components/logo-institucional'
import { INSTITUTION_NAME } from '@/lib/course-data'

export function InstitutionalHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-5 py-3 sm:px-8">
        <LogoInstitucional alt={INSTITUTION_NAME} prioridade className="h-9 w-auto sm:h-11" />
        <div className="border-l border-border pl-4">
          <p className="text-[13px] font-semibold leading-tight sm:text-sm">
            Escola de Educação e Saúde
          </p>
          <p className="text-[11px] leading-tight text-muted-foreground sm:text-xs">
            {INSTITUTION_NAME}
          </p>
        </div>
      </div>
    </header>
  )
}
