'use client'

import { useEffect } from 'react'
import { assinarConsentimento, lerConsentimento } from '@/lib/consentimento-cliente'
import { aplicarConsentimentoAoPixel } from '@/lib/pixel'
import { PIXEL_ID } from '@/lib/pixel-id'

/**
 * Pixel do Meta, em todas as páginas — mas só com consentimento de marketing.
 *
 * Sem ID configurado, nada é instalado — nenhum pixel fictício. Com ID, nada
 * do Meta chega à página enquanto a pessoa não aceitar marketing no aviso de
 * cookies (`components/aviso-de-cookies.tsx`), ou no site principal: o cookie
 * `cvrj_consentimento` é o mesmo em todo *.cruzvermelhariodejaneiro.org. A
 * lógica mora em `lib/pixel.ts`; aqui só se aplica a escolha ao montar e a
 * cada mudança.
 *
 * `PIXEL_ID` vem de `lib/pixel-id.ts`, um módulo neutro: este componente é de
 * cliente e recebe o valor embutido no bundle pelo build. Nunca o importe de
 * `lib/rastreio.ts` num Server Component (ver o comentário em
 * `lib/pixel-id.ts`).
 *
 * Não há `<noscript>` com a imagem do Pixel, de propósito: ela dispararia o
 * PageView sem passar por consentimento nenhum.
 */
export function MetaPixel() {
  useEffect(() => {
    if (!PIXEL_ID) return
    aplicarConsentimentoAoPixel(lerConsentimento())
    return assinarConsentimento(consentimento => aplicarConsentimentoAoPixel(consentimento, { imediato: true }))
  }, [])

  return null
}
