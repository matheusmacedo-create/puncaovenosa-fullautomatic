'use client'

import { Analytics, type BeforeSendEvent } from '@vercel/analytics/next'
import { useEffect, useState } from 'react'
import { assinarConsentimento, lerConsentimento } from '@/lib/consentimento-cliente'

/**
 * Medição de audiência (Vercel Web Analytics), só com consentimento de
 * estatística — o `e=1` do cookie `cvrj_consentimento`.
 *
 * Antes da permissão, o componente nem monta, e o script da medição não é
 * baixado. Se a permissão sair depois, o script já carregado continua na
 * página até ela ser recarregada, mas `beforeSend` descarta tudo o que ele
 * tentaria enviar.
 *
 * A credencial do aluno (`/validar/<token>`) nunca vai na URL medida: vira
 * `/validar/[token]`, o bastante para contar leituras sem expor o token a quem
 * abre o painel da medição.
 */
function antesDeEnviar(evento: BeforeSendEvent): BeforeSendEvent | null {
  if (!lerConsentimento()?.estatistica) return null
  return { ...evento, url: evento.url.replace(/\/validar\/[^/?#]+/, '/validar/[token]') }
}

export function EstatisticaConsentida() {
  const [ligada, setLigada] = useState(false)

  useEffect(() => {
    const aplicar = (consentimento: { estatistica: boolean } | null) => {
      if (consentimento?.estatistica) setLigada(true)
    }
    aplicar(lerConsentimento())
    return assinarConsentimento(aplicar)
  }, [])

  return ligada ? <Analytics beforeSend={antesDeEnviar} /> : null
}
