'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Consentimento, Escolha } from '@/lib/consentimento'
import { assinarConsentimento, gravarConsentimento, lerConsentimento } from '@/lib/consentimento-cliente'
import { courseData } from '@/lib/course-data'

/**
 * Aviso de cookies (LGPD; Guia de Cookies da ANPD, 2022) — o mesmo do site
 * principal, reescrito como componente: textos, botões e comportamento de
 * `site/consentimento/consentimento.js`.
 *
 * Primeiro nível: três botões do mesmo tamanho e do mesmo estilo (Rejeitar,
 * Personalizar, Aceitar todos) — nenhum empurra para o "sim". Segundo nível:
 * as categorias, com estatística e marketing desligados até a pessoa ligar.
 * A escolha vai para o cookie `cvrj_consentimento` (`lib/consentimento.ts`),
 * compartilhado com o site principal: quem já escolheu lá não vê este aviso.
 *
 * "Preferências de cookies": qualquer elemento com `data-cvrj-cookies` reabre
 * as categorias — o rodapé usa um link para a Política de Cookies com esse
 * atributo, que continua levando à página certa se este script não carregar.
 *
 * Dentro da gaveta do checkout (iframe) o primeiro nível não aparece: quem
 * pergunta é a landing, por fora. As preferências abrem normalmente se o link
 * for clicado lá dentro.
 */

const T = {
  titulo: 'Sua privacidade',
  texto: 'Usamos cookies necessários para o site funcionar. Com a sua permissão, usamos também cookies de estatística (Vercel Web Analytics), para saber quais páginas são lidas, e de marketing (Pixel da Meta), para medir nossas campanhas. Você escolhe, e pode mudar quando quiser em “Preferências de cookies”, no rodapé.',
  politica: 'Política de Cookies',
  rejeitar: 'Rejeitar',
  personalizar: 'Personalizar',
  aceitar: 'Aceitar todos',
  painel: 'Preferências de cookies',
  intro: 'Escolha quais cookies podemos usar. Os necessários ficam sempre ligados, porque sem eles o site não funciona.',
  categorias: {
    necessarios: ['Necessários', 'Fazem o site funcionar: guardam a sua escolha sobre cookies, a sessão e o rascunho da sua inscrição e a cópia da ficha do aluno para abrir sem internet.'],
    estatistica: ['Estatística', 'Vercel Web Analytics: conta as visitas e mostra quais páginas são lidas, sem identificar você pelo nome.'],
    marketing: ['Marketing', 'Pixel da Meta (Facebook e Instagram): mede o alcance das nossas campanhas de divulgação.'],
  },
  sempre: 'Sempre ligados',
  rejeitarTudo: 'Rejeitar não necessários',
  salvar: 'Salvar escolhas',
  fechar: 'Fechar',
} as const

const NADA: Escolha = { estatistica: false, marketing: false }
const TUDO: Escolha = { estatistica: true, marketing: true }

declare global {
  interface Window {
    /** Mesmo nome e forma do site principal: `ler()` devolve a escolha, `abrir()` mostra as categorias. */
    cvrjConsentimento?: { ler: () => Consentimento | null; abrir: () => void }
  }
}

export function AvisoDeCookies() {
  const [aviso, setAviso] = useState(false)
  const [painel, setPainel] = useState<Escolha | null>(null)
  const [embutido, setEmbutido] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)
  const voltarFoco = useRef<HTMLElement | null>(null)
  const painelAberto = painel !== null

  const devolverFoco = () => {
    const alvo = voltarFoco.current
    voltarFoco.current = null
    if (alvo && document.contains(alvo)) {
      try { alvo.focus() } catch { /* segue */ }
    }
  }

  const abrirPainel = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) voltarFoco.current = document.activeElement
    const atual = lerConsentimento()
    setAviso(false)
    setPainel({ estatistica: atual?.estatistica ?? false, marketing: atual?.marketing ?? false })
  }, [])

  /** Fechar sem escolher: sem escolha gravada, o primeiro nível volta. */
  const fecharPainel = useCallback(() => {
    setPainel(null)
    if (!lerConsentimento() && window.self === window.top) setAviso(true)
    devolverFoco()
  }, [])

  const escolher = (escolha: Escolha) => {
    gravarConsentimento(escolha)
    setAviso(false)
    setPainel(null)
    devolverFoco()
  }

  useEffect(() => {
    const dentroDaGaveta = window.self !== window.top
    setEmbutido(dentroDaGaveta)
    if (!lerConsentimento() && !dentroDaGaveta) setAviso(true)

    const aoClicar = (e: MouseEvent) => {
      const alvo = e.target instanceof Element ? e.target.closest('[data-cvrj-cookies]') : null
      if (!alvo) return
      e.preventDefault()
      abrirPainel()
    }
    document.addEventListener('click', aoClicar)
    // Escolha feita noutro documento (a landing, com a gaveta aberta; outra
    // aba; o site principal): o primeiro nível sai.
    const cancelar = assinarConsentimento(c => { if (c) setAviso(false) })
    window.cvrjConsentimento = { ler: lerConsentimento, abrir: abrirPainel }

    return () => {
      document.removeEventListener('click', aoClicar)
      cancelar()
      delete window.cvrjConsentimento
    }
  }, [abrirPainel])

  // Com as categorias abertas: foco na primeira chave, Esc fecha, Tab circula
  // dentro da caixa.
  useEffect(() => {
    if (!painelAberto) return
    caixa.current?.querySelector<HTMLInputElement>('input:not([disabled])')?.focus()
    const teclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); fecharPainel(); return }
      if (e.key !== 'Tab' || !caixa.current) return
      const focaveis = caixa.current.querySelectorAll<HTMLElement>('button, a[href], input:not([disabled])')
      if (!focaveis.length) return
      const primeiro = focaveis[0]
      const ultimo = focaveis[focaveis.length - 1]
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus() }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus() }
    }
    document.addEventListener('keydown', teclado, true)
    return () => document.removeEventListener('keydown', teclado, true)
  }, [painelAberto, fecharPainel])

  const linkDaPolitica = (
    <a href={courseData.cookiePolicyUrl} target={embutido ? '_blank' : undefined} rel={embutido ? 'noopener noreferrer' : undefined}>
      {T.politica}
    </a>
  )

  return <>
    {aviso && <section className="cvrj-ck" role="region" aria-labelledby="cvrj-ck-t1">
      <h2 id="cvrj-ck-t1">{T.titulo}</h2>
      <p>{T.texto} {linkDaPolitica}.</p>
      <div className="cvrj-ck-botoes">
        <button type="button" onClick={() => escolher(NADA)}>{T.rejeitar}</button>
        <button type="button" onClick={abrirPainel}>{T.personalizar}</button>
        <button type="button" onClick={() => escolher(TUDO)}>{T.aceitar}</button>
      </div>
    </section>}

    {painel && <div className="cvrj-ck-fundo" onClick={e => { if (e.target === e.currentTarget) fecharPainel() }}>
      <div ref={caixa} className="cvrj-ck-painel" role="dialog" aria-modal="true" aria-labelledby="cvrj-ck-t2">
        <button type="button" className="cvrj-ck-fechar" aria-label={T.fechar} onClick={fecharPainel}>×</button>
        <h2 id="cvrj-ck-t2">{T.painel}</h2>
        <p>{T.intro} {linkDaPolitica}.</p>
        <Categoria chave="necessarios" ligada fixa />
        <Categoria chave="estatistica" ligada={painel.estatistica} alternar={() => setPainel(p => p && { ...p, estatistica: !p.estatistica })} />
        <Categoria chave="marketing" ligada={painel.marketing} alternar={() => setPainel(p => p && { ...p, marketing: !p.marketing })} />
        <div className="cvrj-ck-botoes">
          <button type="button" onClick={() => escolher(NADA)}>{T.rejeitarTudo}</button>
          <button type="button" onClick={() => escolher(painel)}>{T.salvar}</button>
          <button type="button" onClick={() => escolher(TUDO)}>{T.aceitar}</button>
        </div>
      </div>
    </div>}
  </>
}

function Categoria({ chave, ligada, fixa, alternar }: {
  chave: keyof typeof T.categorias
  ligada: boolean
  fixa?: boolean
  alternar?: () => void
}) {
  const [nome, descricao] = T.categorias[chave]
  const id = `cvrj-ck-${chave}`
  return <div className="cvrj-ck-cat">
    <label htmlFor={id}>
      <span>{nome}</span>
      {fixa && <span className="cvrj-ck-sempre">{T.sempre}</span>}
      <input type="checkbox" role="switch" id={id} checked={ligada} disabled={fixa} readOnly={fixa} onChange={alternar} aria-describedby={`${id}-descricao`} />
      <span className="cvrj-ck-chave" aria-hidden="true" />
    </label>
    <p id={`${id}-descricao`}>{descricao}</p>
  </div>
}
