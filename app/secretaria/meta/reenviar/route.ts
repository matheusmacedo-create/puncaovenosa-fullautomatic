import { NextResponse } from 'next/server'
import { NOME_PARA_ETAPA } from '@/lib/etapas-funil'
import { ETAPAS_COM_CAPI, reenviarConversaoMeta } from '@/lib/meta-capi'
import { secretariaAutenticada, secretariaHabilitada } from '@/lib/secretaria'

/**
 * Reenvia manualmente um evento de conversão ao Meta, a partir do painel
 * /secretaria. Mesmo padrão de /secretaria/webhook/reenviar.
 */
export async function POST(request: Request) {
  if (!secretariaHabilitada() || !(await secretariaAutenticada())) {
    return new NextResponse('Não encontrado.', { status: 404 })
  }

  const form = await request.formData()
  const inscricaoId = String(form.get('inscricaoId') ?? '')
  const nomeDoEvento = String(form.get('evento') ?? '')
  const pagamentoId = form.get('pagamentoId')
  const destino = new URL('/secretaria', request.url)

  const etapa = NOME_PARA_ETAPA[nomeDoEvento]
  if (!inscricaoId || !etapa || !ETAPAS_COM_CAPI.includes(etapa)) {
    destino.searchParams.set('erroMeta', '1')
    return NextResponse.redirect(destino, { status: 303 })
  }

  try {
    await reenviarConversaoMeta(inscricaoId, etapa, typeof pagamentoId === 'string' && pagamentoId ? pagamentoId : undefined)
  } catch (e) {
    console.error('[secretaria] reenvio manual à Meta CAPI falhou:', e)
    destino.searchParams.set('erroMeta', '1')
    return NextResponse.redirect(destino, { status: 303 })
  }

  destino.searchParams.set('reenviadoMeta', '1')
  return NextResponse.redirect(destino, { status: 303 })
}
