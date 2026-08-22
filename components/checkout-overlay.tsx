'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { X } from 'lucide-react'
import { courseData } from '@/lib/course-data'
import { MENSAGEM_FECHAR_CHECKOUT } from '@/lib/enrollment'

type CheckoutOverlayContextValue = {
  open: (url: string) => void
  close: () => void
}

const CheckoutOverlayContext = createContext<CheckoutOverlayContextValue | null>(null)

/**
 * Exibe o checkout dentro de uma gaveta sobreposta à página, em vez de
 * navegar para fora. No desktop a landing continua visível ao fundo; no
 * mobile a gaveta ocupa a tela inteira.
 *
 * O checkout é rota deste mesmo app (`/inscricao`), e não outro domínio.
 * Isso não é detalhe de organização: a sessão do funil é um cookie
 * `SameSite=Lax`, que o navegador simplesmente não envia dentro de um
 * iframe de outra origem — o aluno pagaria e voltaria sem inscrição.
 */
export function CheckoutOverlayProvider({ children }: { children: ReactNode }) {
  const [url, setUrl] = useState<string | null>(null)

  const open = useCallback((target: string) => setUrl(target), [])
  const close = useCallback(() => setUrl(null), [])

  useEffect(() => {
    if (!url) return

    const previousOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close()
    }

    window.history.pushState({ checkoutOverlay: true }, '')
    function handlePopState() {
      close()
    }

    // O botão de fechar de dentro do funil pede a gaveta de volta por aqui.
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return
      if (event.data === MENSAGEM_FECHAR_CHECKOUT) close()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('popstate', handlePopState)
    window.addEventListener('message', handleMessage)

    return () => {
      document.documentElement.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('message', handleMessage)
    }
  }, [url, close])

  const value = useMemo(() => ({ open, close }), [open, close])

  return (
    <CheckoutOverlayContext.Provider value={value}>
      {children}

      {url ? (
        <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Matrícula">
          {/* Fundo: no desktop deixa a landing visível por trás; no mobile a gaveta já ocupa tudo. */}
          <button
            type="button"
            aria-label="Fechar e voltar para a página"
            onClick={close}
            className="absolute inset-0 hidden bg-foreground/50 backdrop-blur-[2px] md:block"
          />

          <div className="absolute inset-0 flex justify-end md:p-4">
            <div className="relative h-full w-full md:max-w-[480px]">
              {/* Fora da caixa que corta: no desktop o botão fica à esquerda
                  dela, e um `overflow-hidden` no mesmo elemento o sumiria. */}
              <button
                type="button"
                onClick={close}
                aria-label="Fechar e voltar para a página"
                className="absolute top-3 left-3 z-10 inline-flex size-9 items-center justify-center rounded-full bg-background/95 text-foreground shadow-md ring-1 ring-border transition-colors hover:bg-muted md:-left-14 md:top-4"
              >
                <X className="size-5" aria-hidden="true" />
                <span className="sr-only">Fechar</span>
              </button>

              <div className="flex h-full w-full flex-col overflow-hidden bg-background shadow-2xl md:rounded-lg md:border md:border-border">
                <iframe
                  src={url}
                  title={`Matrícula — ${courseData.courseName}`}
                  className="size-full flex-1 border-0"
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </CheckoutOverlayContext.Provider>
  )
}

export function useCheckoutOverlay() {
  const ctx = useContext(CheckoutOverlayContext)
  if (!ctx) {
    throw new Error('useCheckoutOverlay must be used within a CheckoutOverlayProvider')
  }
  return ctx
}
