'use client'

import {
  type Consentimento, consentimentoDoCabecalho, COOKIE_CONSENTIMENTO, dominioDoConsentimento,
  type Escolha, VALIDADE_DO_CONSENTIMENTO_S, valorDoConsentimento,
} from '@/lib/consentimento'

/**
 * O consentimento do lado do navegador: ler, gravar e avisar quem depende dele
 * (o Pixel em `lib/pixel.ts`, a medição de audiência, o próprio aviso).
 *
 * O aviso atravessa documentos: a landing e o funil vivem juntos na tela quando
 * a gaveta do checkout está aberta (dois documentos, a landing e o iframe), e
 * uma escolha feita num precisa valer no outro na mesma hora — senão o funil
 * dentro da gaveta continuaria sem Pixel depois do "Aceitar todos" da landing,
 * ou com Pixel depois do "Rejeitar". Por isso, além do evento no `document`
 * (o mesmo nome que o aviso do site principal dispara), a escolha vai por um
 * `BroadcastChannel`, que também alcança outras abas deste endereço.
 */

const EVENTO = 'cvrj:consentimento'
const CANAL = 'cvrj-consentimento'

type Ouvinte = (consentimento: Consentimento | null) => void

const ouvintes = new Set<Ouvinte>()
let canalAberto: BroadcastChannel | null | undefined

export function lerConsentimento(): Consentimento | null {
  if (typeof document === 'undefined') return null
  return consentimentoDoCabecalho(document.cookie)
}

function avisar(consentimento: Consentimento | null) {
  for (const ouvinte of ouvintes) ouvinte(consentimento)
  try { document.dispatchEvent(new CustomEvent(EVENTO, { detail: consentimento })) } catch { /* navegador antigo */ }
}

function canal(): BroadcastChannel | null {
  if (canalAberto !== undefined) return canalAberto
  canalAberto = typeof BroadcastChannel === 'function' ? new BroadcastChannel(CANAL) : null
  // Quem recebe relê o cookie em vez de confiar na mensagem: o cookie é a
  // fonte da verdade, e é o mesmo para os dois documentos.
  canalAberto?.addEventListener('message', () => avisar(lerConsentimento()))
  return canalAberto
}

/**
 * Tirou a permissão depois de dar: os cookies das ferramentas saem do
 * navegador — os de primeira parte, que o próprio site consegue apagar. Mesma
 * lista do site principal: `_ga*` pode ter sido gravado lá, no domínio
 * compartilhado, e só sai daqui se for apagado nele também.
 */
function apagarCookiesDeMedicao({ estatistica, marketing }: Escolha) {
  const dominio = dominioDoConsentimento(location.hostname)
  const nomes = document.cookie.split(';').map(c => c.split('=')[0].trim())
  for (const nome of nomes) {
    const deEstatistica = nome === '_ga' || nome.startsWith('_ga_') || nome === '_gid' || nome.startsWith('_gat')
    const deMarketing = nome === '_fbp' || nome === '_fbc'
    if ((deEstatistica && !estatistica) || (deMarketing && !marketing)) {
      for (const d of ['', location.hostname, dominio]) {
        document.cookie = `${nome}=; Max-Age=0; Path=/${d ? `; Domain=${d}` : ''}`
      }
    }
  }
}

/** Grava a escolha, limpa o que ela deixou de permitir e avisa este e os outros documentos. */
export function gravarConsentimento(escolha: Escolha) {
  const dominio = dominioDoConsentimento(location.hostname)
  document.cookie = `${COOKIE_CONSENTIMENTO}=${valorDoConsentimento(escolha)}; Max-Age=${VALIDADE_DO_CONSENTIMENTO_S}; Path=/; SameSite=Lax`
    + (location.protocol === 'https:' ? '; Secure' : '')
    + (dominio ? `; Domain=${dominio}` : '')
  apagarCookiesDeMedicao(escolha)
  const gravado = lerConsentimento() ?? { ...escolha, em: Math.floor(Date.now() / 1000) }
  avisar(gravado)
  canal()?.postMessage('mudou')
  // A escolha também vale para a inscrição desta sessão, se houver: é por ela
  // que o servidor decide se manda eventos ao Meta quando o aviso de
  // pagamento chega sem navegador nenhum (postback da Únicopag). O servidor
  // lê o cookie recém-gravado da própria requisição — não há corpo.
  fetch('/api/consentimento', { method: 'POST', keepalive: true }).catch(() => undefined)
}

/**
 * Chama `ouvinte` a cada mudança de escolha — neste documento, noutro
 * documento deste endereço (a gaveta do checkout, outra aba) ou noutro
 * subdomínio (percebida quando a aba volta a ficar visível: o cookie é
 * compartilhado, mas o aviso não atravessa origens). Devolve a função que
 * cancela a assinatura.
 */
export function assinarConsentimento(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte)
  canal()
  const aoVoltar = () => { if (document.visibilityState === 'visible') ouvinte(lerConsentimento()) }
  document.addEventListener('visibilitychange', aoVoltar)
  return () => {
    ouvintes.delete(ouvinte)
    document.removeEventListener('visibilitychange', aoVoltar)
  }
}
