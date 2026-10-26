import { NextResponse } from 'next/server'
import { ligarWebhook } from '@/lib/kapso'
import { secretariaAutenticada, secretariaHabilitada } from '@/lib/secretaria'
import { siteUrl } from '@/lib/site-url'

/**
 * Liga, pelo painel, o recebimento das mensagens do número da escola: cria
 * (ou acerta) o webhook na Kapso apontando para /api/webhooks/kapso, com a
 * senha certa. Não manda mensagem a ninguém. Formulário sem JavaScript, como
 * os outros botões de /secretaria.
 */
export async function POST(request: Request) {
  if (!secretariaHabilitada() || !(await secretariaAutenticada())) {
    return new NextResponse('Não encontrado.', { status: 404 })
  }

  const destino = new URL('/secretaria', request.url)
  const base = siteUrl()
  if (!base) {
    destino.searchParams.set('erroWhatsapp', 'Defina NEXT_PUBLIC_SITE_URL com o endereço público do site.')
    return NextResponse.redirect(destino, { status: 303 })
  }

  const { erro } = await ligarWebhook(`${base}/api/webhooks/kapso`)
  if (erro) destino.searchParams.set('erroWhatsapp', erro)
  else destino.searchParams.set('webhookLigado', '1')
  return NextResponse.redirect(destino, { status: 303 })
}
