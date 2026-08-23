import { NextResponse } from 'next/server'
import { criarPublicoDeAbandono } from '@/lib/meta-audiencia'
import { secretariaAutenticada, secretariaHabilitada } from '@/lib/secretaria'

/**
 * Setup único: cria o público personalizado no Meta e devolve o id para
 * quem está configurando salvar em META_AUDIENCE_ABANDONADOS_ID na Vercel.
 * Chamar de novo depois disso criaria um segundo público vazio — é para
 * rodar uma vez só, não para entrar no fluxo normal.
 */
export async function POST(request: Request) {
  if (!secretariaHabilitada() || !(await secretariaAutenticada())) {
    return new NextResponse('Não encontrado.', { status: 404 })
  }

  const form = await request.formData()
  const adAccountId = String(form.get('adAccountId') ?? '').trim()
  const destino = new URL('/secretaria', request.url)

  if (!adAccountId.startsWith('act_')) {
    destino.searchParams.set('erroAudienciaCriar', 'O ID da conta de anúncios precisa começar com "act_".')
    return NextResponse.redirect(destino, { status: 303 })
  }

  try {
    const { id } = await criarPublicoDeAbandono(adAccountId)
    destino.searchParams.set('audienciaCriada', id)
  } catch (e) {
    console.error('[secretaria] criação do público de remarketing falhou:', e)
    const mensagem = e instanceof Error ? e.message : 'falha desconhecida'
    destino.searchParams.set('erroAudienciaCriar', mensagem.slice(0, 300))
  }

  return NextResponse.redirect(destino, { status: 303 })
}
