'use client'

import { useEffect, useId, useRef, useState } from 'react'

export type Aba = { id: string; rotulo: string; conteudo: React.ReactNode }

const CHAVE = 'cvb-secretaria-aba'

/**
 * Divide o painel em uma seção por vez.
 *
 * A página inteira aberta de uma vez eram sete blocos competindo pela
 * atenção, e nenhum deles dizia qual olhar primeiro. Separar em abas troca
 * "tudo ao mesmo tempo" por "uma coisa, escolhida por você" — quem só quer
 * achar um aluno nunca mais esbarra no log do Pixel.
 *
 * Nada aqui se move sozinho: não há troca automática de aba, nem animação de
 * transição, nem recarregamento em segundo plano. A aba só muda quando
 * alguém clica ou usa as setas, e é a mesma da última visita.
 *
 * Todos os painéis ficam montados e os inativos usam `hidden`, em vez de
 * serem removidos: o mapa não precisa se reconstruir a cada troca, e o
 * atributo já tira o conteúdo escondido do leitor de tela.
 */
export function SecretariaAbas({ abas }: { abas: Aba[] }) {
  const [ativa, setAtiva] = useState(abas[0]?.id)
  const prefixo = useId()
  const botoes = useRef<(HTMLButtonElement | null)[]>([])

  // Só depois de montar, para não divergir do HTML que veio do servidor.
  useEffect(() => {
    try {
      const salva = window.localStorage.getItem(CHAVE)
      if (salva && abas.some(a => a.id === salva)) setAtiva(salva)
    } catch {
      // localStorage indisponível: fica na primeira aba, que é um padrão válido.
    }
  }, [abas])

  const escolher = (id: string) => {
    setAtiva(id)
    try { window.localStorage.setItem(CHAVE, id) } catch { /* preferência não persiste; a navegação segue */ }
  }

  // Setas percorrem as abas, que é o que um leitor de tela anuncia como
  // possível assim que o grupo recebe foco.
  const naTecla = (e: React.KeyboardEvent, indice: number) => {
    const passo = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!passo) return
    e.preventDefault()
    const proximo = (indice + passo + abas.length) % abas.length
    escolher(abas[proximo].id)
    botoes.current[proximo]?.focus()
  }

  return <div className="secretaria-abas">
    <div role="tablist" aria-label="Seções do painel" className="secretaria-abas-lista">
      {abas.map((aba, indice) => (
        <button
          key={aba.id}
          ref={el => { botoes.current[indice] = el }}
          role="tab"
          type="button"
          id={`${prefixo}-aba-${aba.id}`}
          aria-controls={`${prefixo}-painel-${aba.id}`}
          aria-selected={ativa === aba.id}
          tabIndex={ativa === aba.id ? 0 : -1}
          className={`secretaria-aba ${ativa === aba.id ? 'ativa' : ''}`}
          onClick={() => escolher(aba.id)}
          onKeyDown={e => naTecla(e, indice)}
        >
          {aba.rotulo}
        </button>
      ))}
    </div>

    {abas.map(aba => (
      <div
        key={aba.id}
        role="tabpanel"
        id={`${prefixo}-painel-${aba.id}`}
        aria-labelledby={`${prefixo}-aba-${aba.id}`}
        hidden={ativa !== aba.id}
        tabIndex={0}
      >
        {aba.conteudo}
      </div>
    ))}
  </div>
}
