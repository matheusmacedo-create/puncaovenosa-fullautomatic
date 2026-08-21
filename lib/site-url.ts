/**
 * URL pública do site, usada para montar o `postback_url` que a Únicopag
 * exige — ela precisa de um endereço acessível pela internet para avisar
 * que o pagamento caiu.
 *
 * A ordem tenta o que é mais estável primeiro: um domínio definido à mão,
 * depois o domínio de produção da Vercel, e só então a URL do deployment
 * (que muda a cada publicação, e por isso é o último recurso).
 */
export function siteUrl(): string | null {
  const explicito = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (explicito) return explicito.replace(/\/+$/, '')

  const producao = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (producao) return `https://${producao}`

  const deployment = process.env.VERCEL_URL?.trim()
  if (deployment) return `https://${deployment}`

  return null
}

export class SiteUrlAusente extends Error {
  constructor() {
    super('Defina NEXT_PUBLIC_SITE_URL com o endereço público do site — a Únicopag exige postback_url.')
    this.name = 'SiteUrlAusente'
  }
}

export function urlDoWebhook(): string {
  const base = siteUrl()
  if (!base) throw new SiteUrlAusente()
  return `${base}/api/webhooks/unicopag`
}
