'use client'

import { useEffect } from 'react'
import { persistVariant, type Variant } from '@/lib/ab-test'
import { trackLandingView } from '@/lib/checkout'

/**
 * Registra a visita e guarda qual página foi vista.
 *
 * Não sorteia e não redireciona: a página já chegou decidida pelo servidor,
 * pelo endereço que a pessoa abriu. O sorteio no cliente que existia aqui
 * recarregava a página inteira quando caía na variante `b` — ver
 * `lib/paginas-de-venda.ts` para por que isso invalidava a medição.
 */
export function VariantAssignment({ variante }: { variante: Variant }) {
  useEffect(() => {
    persistVariant(variante)
    trackLandingView(variante)
  }, [variante])

  return null
}
