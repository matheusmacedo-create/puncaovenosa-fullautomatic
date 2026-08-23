import { NextResponse } from 'next/server'
import { secretariaAutenticada, secretariaHabilitada } from '@/lib/secretaria'
import { EVENTOS_WEBHOOK, EventoWebhook, reenviarParaSecretaria } from '@/lib/webhook-secretaria'

/**
 * Reenvia manualmente um evento que falhou, a partir do painel /secretaria.
 *
 * Recebe o formulário da própria tabela de entregas e redireciona de volta —
 * mesmo padrão de /secretaria/entrar, para funcionar sem JavaScript. Exige
 * sessão da secretaria: é o mesmo gatilho que o funil já usa sozinho em cada
 * transição de status, só que disparado à mão.
 */
export async function POST(request: Request) {
  if (!secretariaHabilitada() || !(await secretariaAutenticada())) {
    return new NextResponse('Não encontrado.', { status: 404 })
  }

  const form = await request.formData()
  const inscricaoId = String(form.get('inscricaoId') ?? '')
  const evento = String(form.get('evento') ?? '')
  const destino = new URL('/secretaria', request.url)

  if (!inscricaoId || !EVENTOS_WEBHOOK.includes(evento as EventoWebhook)) {
    destino.searchParams.set('erroWebhook', '1')
    return NextResponse.redirect(destino, { status: 303 })
  }

  try {
    await reenviarParaSecretaria(inscricaoId, evento as EventoWebhook)
  } catch (e) {
    console.error('[secretaria] reenvio manual falhou:', e)
    destino.searchParams.set('erroWebhook', '1')
    return NextResponse.redirect(destino, { status: 303 })
  }

  destino.searchParams.set('reenviado', '1')
  return NextResponse.redirect(destino, { status: 303 })
}
