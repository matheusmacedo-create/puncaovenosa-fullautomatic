'use client'

import { useEffect } from 'react'
import { resolveClientVariant, type Variant } from '@/lib/ab-test'
import { trackLandingView } from '@/lib/checkout'

/**
 * Garante que todo visitante tenha uma variante persistida.
 *
 * Quando a URL não traz ?variant=, o sorteio 50/50 acontece aqui e o
 * resultado é gravado em cookie e localStorage. Se o valor sorteado for
 * diferente do que o servidor renderizou, a página é reapresentada com o
 * parâmetro explícito — assim o visitante permanece na mesma variante em
 * recarregamentos e retornos, sem quebrar o cache da rota.
 */
export function VariantAssignment({ requested }: { requested: Variant | null }) {
  useEffect(() => {
    const resolved = resolveClientVariant()
    if (!requested && resolved !== 'a') {
      const url = new URL(window.location.href)
      url.searchParams.set('variant', resolved)
      window.location.replace(url.toString())
      // A página vai recarregar: a visita é contada do outro lado, com a
      // variante certa. Contar aqui somaria uma visita que ninguém viu.
      return
    }
    trackLandingView(requested ?? resolved)
  }, [requested])

  return null
}
