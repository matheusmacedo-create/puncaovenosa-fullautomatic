'use client'

import { useEffect } from 'react'
import { rastrearEngajamento } from '@/lib/rastreio'

const MARCOS_DE_ROLAGEM = [25, 50, 75, 90]
const SEGUNDOS_ENGAJADO = 30

/**
 * Rolagem e tempo de permanência da landing, para o Meta aprender quem é
 * visitante engajado — sinal que campanha de conversão usa para otimizar, e
 * que serve de público de remarketing pra quem nunca chega a clicar em nada.
 *
 * Só na landing, nunca dentro do funil embutido no iframe: lá o interesse já
 * está provado pelo clique no CTA, e a página é curta demais pra rolagem
 * significar algo.
 */
export function EngagementTracking() {
  useEffect(() => {
    const disparados = new Set<number>()

    function checarRolagem() {
      const doc = document.documentElement
      const alturaRolavel = doc.scrollHeight - doc.clientHeight
      if (alturaRolavel <= 0) return
      const percentual = (window.scrollY / alturaRolavel) * 100
      for (const marco of MARCOS_DE_ROLAGEM) {
        if (percentual >= marco && !disparados.has(marco)) {
          disparados.add(marco)
          rastrearEngajamento(`scroll_${marco}`, { percentual: marco })
        }
      }
    }

    let aguardando = false
    function aoRolar() {
      if (aguardando) return
      aguardando = true
      requestAnimationFrame(() => { checarRolagem(); aguardando = false })
    }

    window.addEventListener('scroll', aoRolar, { passive: true })
    checarRolagem() // cobre quem já abre a página rolada ou uma tela alta o bastante pra caber tudo

    const temporizador = window.setTimeout(() => {
      // Se a aba não está visível no momento exato, não afirma que a pessoa
      // ficou engajada — melhor não disparar do que reportar tempo que ela
      // passou noutra aba.
      if (document.visibilityState === 'visible') rastrearEngajamento(`tempo_${SEGUNDOS_ENGAJADO}s`)
    }, SEGUNDOS_ENGAJADO * 1000)

    return () => {
      window.removeEventListener('scroll', aoRolar)
      window.clearTimeout(temporizador)
    }
  }, [])

  return null
}
