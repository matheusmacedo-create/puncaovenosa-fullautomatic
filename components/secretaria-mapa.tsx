'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import type { CircleMarker, Map as LeafletMap } from 'leaflet'

export type PontoMapa = {
  id: string
  latitude: number
  longitude: number
  /** Texto pronto para o popup — já traduzido, o componente não sabe de status. */
  popup: string
  /** Quando a inscrição entrou, usado só para calcular a cor. */
  criadoEm: string
}

// Centro do Rio de Janeiro, onde o curso acontece — é para onde o mapa abre
// enquanto não há pontos, e a partir de onde ele calcula o zoom inicial.
const CENTRO_RIO: [number, number] = [-22.9068, -43.1729]

/**
 * Cor por idade da inscrição: verde forte para quem acabou de entrar,
 * esmaecendo para um laranja fraco conforme as semanas passam. A ideia não é
 * status — é ver o mapa "preenchendo" com o tempo, e enxergar de longe onde
 * a região ficou parada.
 *
 * A janela é de 8 semanas: quem entrou hoje sai verde forte, quem entrou há
 * 8 semanas ou mais sai no laranja mais fraco do gradiente, sem ficar mais
 * fraco que isso depois.
 */
const JANELA_DIAS = 56
const VERDE_FORTE: [number, number, number] = [21, 163, 74] // recém-chegado
const LARANJA_FRACO: [number, number, number] = [224, 184, 143] // várias semanas depois

function corPorIdade(dias: number) {
  const t = Math.max(0, Math.min(1, dias / JANELA_DIAS))
  const [r1, g1, b1] = VERDE_FORTE
  const [r2, g2, b2] = LARANJA_FRACO
  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const b = Math.round(b1 + (b2 - b1) * t)
  // A opacidade também cai com o tempo: reforça o mesmo efeito de "esmaecer".
  const opacidade = 0.85 - 0.35 * t
  return { cor: `rgb(${r}, ${g}, ${b})`, opacidade }
}

/**
 * Mapa de onde vêm as inscrições, a partir do CEP/endereço informado na
 * triagem — um ponto aproximado por inscrição, não a rua exata.
 *
 * Importa o Leaflet dentro do `useEffect`, nunca no topo do arquivo — o
 * pacote toca em `window`/`document` ao inicializar, e este componente
 * também é executado no servidor para montar o HTML inicial da página.
 */
export function SecretariaMapa({ pontos }: { pontos: PontoMapa[] }) {
  const divRef = useRef<HTMLDivElement>(null)
  const mapaRef = useRef<LeafletMap | null>(null)

  useEffect(() => {
    if (!divRef.current) return
    let cancelado = false

    import('leaflet').then(({ default: L }) => {
      if (cancelado || !divRef.current) return

      const mapa = L.map(divRef.current, { scrollWheelZoom: false }).setView(CENTRO_RIO, 11)
      mapaRef.current = mapa

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(mapa)

      const agora = Date.now()
      const marcadores: CircleMarker[] = pontos.map(ponto => {
        const dias = Math.max(0, (agora - new Date(ponto.criadoEm).getTime()) / 86_400_000)
        const { cor, opacidade } = corPorIdade(dias)
        return L.circleMarker([ponto.latitude, ponto.longitude], {
          radius: 6,
          color: cor,
          fillColor: cor,
          fillOpacity: opacidade,
          weight: 1,
        }).addTo(mapa).bindPopup(ponto.popup)
      })

      if (marcadores.length) {
        const limites = L.featureGroup(marcadores).getBounds()
        mapa.fitBounds(limites.pad(0.3), { maxZoom: 13 })
      }
    })

    return () => {
      cancelado = true
      mapaRef.current?.remove()
      mapaRef.current = null
    }
  }, [pontos])

  return <div ref={divRef} className="secretaria-mapa" role="img" aria-label="Mapa com a região de origem das inscrições" />
}
