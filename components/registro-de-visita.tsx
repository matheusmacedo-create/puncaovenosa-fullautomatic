'use client'

import { useEffect } from 'react'
import { trackLandingView } from '@/lib/checkout'

/**
 * Conta a visita à landing — o topo do funil, que não tem inscrição para
 * ancorar (ver `visitas_landing`, migration 0011).
 *
 * Roda uma vez por carregamento e não renderiza nada. A gravação é
 * otimista: quem está lendo a página nunca espera por ela nem vê uma falha.
 */
export function RegistroDeVisita() {
  useEffect(() => {
    trackLandingView()
  }, [])

  return null
}
