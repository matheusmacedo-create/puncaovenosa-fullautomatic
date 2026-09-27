'use client'

import type { Consentimento } from '@/lib/consentimento'
import { PIXEL_ID } from '@/lib/pixel-id'

/**
 * O Pixel do Meta, só com consentimento de marketing (LGPD; Guia de Cookies
 * da ANPD).
 *
 * Antes de a pessoa escolher, nada do Meta existe na página: nem o
 * `fbevents.js` é baixado, nem `window.fbq` é criado. Os eventos do funil que
 * acontecem nesse intervalo (a visita à landing, o clique no CTA) ficam numa
 * fila em memória — nada sai do navegador — e só vão ao Meta se a escolha for
 * "sim" nesta mesma página. Com "não", a fila é descartada e os eventos
 * seguintes nem entram nela. Tirar a permissão depois de dar chama
 * `fbq('consent', 'revoke')`, e daí em diante nenhum evento é repassado.
 *
 * Nunca chame `fbq` direto: os eventos passam por `lib/rastreio.ts`, que usa
 * `enviarAoPixel` daqui.
 */

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void
  queue: unknown[]
  push: unknown
  loaded: boolean
  version: string
}

type JanelaComPixel = Window & { fbq?: Fbq; _fbq?: Fbq }

const SCRIPT_DO_PIXEL = 'https://connect.facebook.net/en_US/fbevents.js'

/**
 * Páginas que nunca carregam o Pixel, com ou sem permissão: `/validar/<token>`
 * levaria a credencial do aluno na URL do PageView, e `/secretaria` é o painel
 * interno — não há o que medir de campanha ali.
 */
const ROTAS_SEM_PIXEL = /^\/(validar|secretaria)(\/|$)/

/** Teto da fila de antes da escolha: o funil inteiro cabe folgado nisso. */
const LIMITE_DA_FILA = 50

type Chamada = unknown[]
type Pendente = { chamadas: Chamada[]; marcarComo?: string }

let estado: 'sem-escolha' | 'liberado' | 'negado' = 'sem-escolha'
let iniciado = false
let baixado = false
const fila: Pendente[] = []

const rotaComPixel = () => typeof window !== 'undefined' && !ROTAS_SEM_PIXEL.test(window.location.pathname)

/** Marca um evento de "uma vez só" como enviado nesta aba (ver `rastrear`). */
function marcar(chave?: string) {
  if (!chave) return
  try { sessionStorage.setItem(chave, '1') } catch { /* armazenamento bloqueado: pode repetir, o eventID deduplica */ }
}

/** O mesmo stub do código oficial do Meta: guarda as chamadas até o `fbevents.js` chegar. */
function criarStub(w: JanelaComPixel): Fbq {
  if (w.fbq) return w.fbq
  // `arguments`, e não `...args`: é o formato que o fbevents.js espera na fila.
  const stub = function () {
    if (stub.callMethod) stub.callMethod.apply(stub, Array.from(arguments))
    else stub.queue.push(arguments)
  } as unknown as Fbq
  w.fbq = stub
  if (!w._fbq) w._fbq = stub
  stub.push = stub
  stub.loaded = true
  stub.version = '2.0'
  stub.queue = []
  return stub
}

function baixarScript() {
  if (baixado) return
  baixado = true
  const script = document.createElement('script')
  script.async = true
  script.src = SCRIPT_DO_PIXEL
  document.head.appendChild(script)
}

/** Baixa quando o navegador estiver ocioso — as chamadas esperam no stub, em memória. */
function baixarQuandoOcioso() {
  const w = window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }
  if (w.requestIdleCallback) w.requestIdleCallback(baixarScript, { timeout: 2500 })
  else window.setTimeout(baixarScript, 800)
}

function esvaziarFila(fbq: Fbq) {
  for (const { chamadas, marcarComo } of fila.splice(0)) {
    marcar(marcarComo)
    for (const chamada of chamadas) fbq(...chamada)
  }
}

/**
 * Aplica a escolha ao Pixel. Chamada ao montar a página (com o cookie que já
 * existia) e a cada mudança. `imediato` baixa o script na hora — é o caso do
 * clique em "Aceitar"; ao montar, espera o navegador ficar ocioso, como o
 * site principal faz.
 */
export function aplicarConsentimentoAoPixel(consentimento: Consentimento | null, { imediato = false } = {}) {
  if (!PIXEL_ID || typeof window === 'undefined') return
  const w = window as JanelaComPixel
  const antes = estado

  if (!consentimento?.marketing || !rotaComPixel()) {
    // Sem cookie nenhum ainda é "sem escolha": os eventos esperam na fila. Um
    // "não" (ou uma página sem Pixel) descarta a fila e tudo o que viria.
    estado = consentimento || !rotaComPixel() ? 'negado' : 'sem-escolha'
    if (estado === 'negado') fila.length = 0
    if (antes === 'liberado' && w.fbq) w.fbq('consent', 'revoke')
    return
  }

  estado = 'liberado'
  const fbq = criarStub(w)
  if (antes !== 'liberado') fbq('consent', 'grant')
  if (!iniciado) {
    iniciado = true
    fbq('init', PIXEL_ID)
    // Dentro da gaveta da landing há dois documentos vivos (a landing e o
    // funil): o PageView fica só com o de fora, senão cada visitante contaria
    // duas visitas e o custo por resultado sairia pela metade.
    if (window.self === window.top) fbq('track', 'PageView')
  }
  esvaziarFila(fbq)
  if (imediato) baixarScript()
  else baixarQuandoOcioso()
}

/**
 * Repassa ao Pixel as chamadas de um evento (`['trackCustom', nome, dados,
 * opções]`, …). Com permissão, vão na hora; sem escolha ainda, esperam na
 * fila em memória; com "não", são descartadas. `marcarComo` é a chave de
 * "uma vez só" de `rastrear`, gravada só quando o evento de fato vai.
 */
export function enviarAoPixel(chamadas: Chamada[], marcarComo?: string) {
  if (!PIXEL_ID || !rotaComPixel()) return
  if (estado === 'liberado') {
    const w = window as JanelaComPixel
    if (!w.fbq) return
    marcar(marcarComo)
    for (const chamada of chamadas) w.fbq(...chamada)
    return
  }
  if (estado === 'negado' || fila.length >= LIMITE_DA_FILA) return
  fila.push({ chamadas, marcarComo })
}

/** O evento de "uma vez só" já está esperando na fila (sem escolha ainda)? */
export function jaNaFilaDoPixel(chave: string) {
  return fila.some(p => p.marcarComo === chave)
}
