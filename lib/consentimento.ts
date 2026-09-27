/**
 * O consentimento de cookies, no formato combinado com o site principal.
 *
 * A escolha da pessoa mora num cookie de primeira parte gravado em
 * `.cruzvermelhariodejaneiro.org`, lido por todos os subdomínios: quem já
 * escolheu no site principal não é perguntado de novo aqui, e o contrário.
 * O formato é o do aviso do site principal (`site/consentimento/consentimento.js`
 * no repositório do site) — mudar um lado sem o outro faz um dos sites ignorar
 * a escolha e perguntar de novo, ou ler "sim" onde a pessoa disse "não".
 *
 *   cvrj_consentimento = encodeURIComponent('v=1&e=<0|1>&m=<0|1>&t=<unix s>')
 *   Domain=.cruzvermelhariodejaneiro.org; Path=/; Max-Age=31536000; SameSite=Lax; Secure
 *
 * `e` é estatística (medição de audiência); `m` é marketing — Pixel da Meta,
 * API de Conversões e público de remarketing. Fora de
 * *.cruzvermelhariodejaneiro.org (localhost, preview da Vercel) o cookie sai
 * sem `Domain`, preso ao próprio endereço.
 *
 * Sem `'use client'` de propósito: o servidor lê o mesmo cookie na requisição
 * para decidir se manda a cópia do evento ao Meta (`lib/meta-capi.ts`) — o
 * mesmo motivo de `lib/pixel-id.ts` e `lib/etapas-funil.ts`.
 */

export const COOKIE_CONSENTIMENTO = 'cvrj_consentimento'

const VERSAO = '1'

/** 12 meses, como no site principal. Depois disso a pessoa é perguntada de novo. */
export const VALIDADE_DO_CONSENTIMENTO_S = 365 * 24 * 60 * 60

const DOMINIO_COMPARTILHADO = '.cruzvermelhariodejaneiro.org'

export type Escolha = { estatistica: boolean; marketing: boolean }

/** `em` é o instante da escolha, em segundos (o `t` do cookie); 0 quando não veio. */
export type Consentimento = Escolha & { em: number }

/** Lê o valor do cookie (ainda codificado). Versão desconhecida vale como "sem escolha". */
export function lerValorDoConsentimento(valor: string | null | undefined): Consentimento | null {
  if (!valor) return null
  const partes: Record<string, string> = {}
  try {
    for (const par of decodeURIComponent(valor).split('&')) {
      const i = par.indexOf('=')
      if (i > 0) partes[par.slice(0, i)] = par.slice(i + 1)
    }
  } catch {
    return null
  }
  if (partes.v !== VERSAO) return null
  return { estatistica: partes.e === '1', marketing: partes.m === '1', em: parseInt(partes.t, 10) || 0 }
}

/** A escolha a partir de um cabeçalho `Cookie` inteiro (ou de `document.cookie`). */
export function consentimentoDoCabecalho(cabecalho: string | null | undefined): Consentimento | null {
  const achado = (cabecalho ?? '').match(/(?:^|;\s*)cvrj_consentimento=([^;]+)/)
  return lerValorDoConsentimento(achado?.[1])
}

/**
 * A escolha de quem fez esta requisição. Só faz sentido numa requisição do
 * navegador do aluno — num postback da Únicopag não há cookie nenhum, e o
 * resultado é "sem escolha", que vale como "não".
 */
export function consentimentoDaRequisicao(request: Request): Consentimento | null {
  return consentimentoDoCabecalho(request.headers.get('cookie'))
}

/** O valor a gravar no cookie, já codificado. */
export function valorDoConsentimento(escolha: Escolha, agora = Date.now()): string {
  const valor = `v=${VERSAO}&e=${escolha.estatistica ? 1 : 0}&m=${escolha.marketing ? 1 : 0}&t=${Math.floor(agora / 1000)}`
  return encodeURIComponent(valor)
}

/** `Domain` do cookie: o compartilhado em *.cruzvermelhariodejaneiro.org, nenhum fora dele. */
export function dominioDoConsentimento(hostname: string): string {
  return /(^|\.)cruzvermelhariodejaneiro\.org$/i.test(hostname) ? DOMINIO_COMPARTILHADO : ''
}
