'use client'

import { useEffect } from 'react'

/**
 * Marca o documento quando ele está rodando dentro da gaveta da landing.
 *
 * O funil foi desenhado para ser uma folha sobre a própria página dele. Dentro
 * da gaveta isso vira moldura em cima de moldura: dois botões de fechar, uma
 * faixa cinza sobrando no topo e a folha ocupando só parte do quadro. A marca
 * aqui deixa o CSS tirar a moldura de dentro e manter só a de fora.
 */
export function EmbeddedFlag() {
  useEffect(() => {
    if (window.self === window.top) return
    document.documentElement.dataset.embutido = 'sim'
    return () => {
      delete document.documentElement.dataset.embutido
    }
  }, [])

  return null
}
