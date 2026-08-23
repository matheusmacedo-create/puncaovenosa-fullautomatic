'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import type { CircleMarker, Map as LeafletMap } from 'leaflet'

export type PontoMapa = {
  id: string
  latitude: number
  longitude: number
  lugar: string
  status: string
}

// Mesmas cores dos selos da tabela (--ok, --warn, --cvb-red, --ink-soft em
// globals.css). Este componente roda só no navegador, então lê hex fixo em
// vez do custom property — mantenha os dois em sincronia se a paleta mudar.
const COR_POR_STATUS: Record<string, string> = {
  triagem_concluida: '#1e7a4a',
  paga: '#1e7a4a',
  aguardando_pagamento: '#a8601a',
  rascunho: '#8b9096',
  cancelada: '#c8102e',
}

// Centro do Rio de Janeiro, onde o curso acontece — é para onde o mapa abre
// enquanto não há pontos, e a partir de onde ele calcula o zoom inicial.
const CENTRO_RIO: [number, number] = [-22.9068, -43.1729]

/**
 * Mapa de onde vêm as inscrições, a partir do CEP informado na triagem.
 *
 * Só desenha ponto para quem tem coordenada gravada — e só a BrasilAPI
 * devolve coordenada, nem sempre. Quem respondeu a triagem antes desta
 * função existir, ou cujo CEP caiu na ViaCEP, não aparece aqui: o mapa é
 * uma amostra do fluxo, não o total de inscrições.
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

      const marcadores: CircleMarker[] = pontos.map(ponto => {
        const cor = COR_POR_STATUS[ponto.status] ?? '#8b9096'
        return L.circleMarker([ponto.latitude, ponto.longitude], {
          radius: 6,
          color: cor,
          fillColor: cor,
          fillOpacity: 0.75,
          weight: 1,
        }).addTo(mapa).bindPopup(ponto.lugar)
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
