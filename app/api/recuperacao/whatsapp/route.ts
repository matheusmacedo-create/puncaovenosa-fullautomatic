import { NextResponse } from 'next/server'
import { executarRecuperacao } from '@/lib/recuperacao-servidor'

/** Até 40 envios em sequência, cada um com até 30 s de espera pela Kapso. */
export const maxDuration = 300

/**
 * A rotina diária da recuperação pelo WhatsApp (vercel.json, 13h UTC = 10h
 * de Brasília — o plano Hobby não libera mais que uma vez por dia).
 *
 * Com a trava fechada (`WHATSAPP_RECUPERACAO_ENVIAR` diferente de "sim"),
 * só conta quantos receberiam e devolve isso — nada é enviado nem gravado.
 *
 * Protegida por CRON_SECRET, como /api/meta-audiencia/sync: sem a variável,
 * a rota fica fechada.
 */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET?.trim()
  if (!segredo || request.headers.get('authorization') !== `Bearer ${segredo}`) {
    return new NextResponse('Não autorizado.', { status: 401 })
  }

  const resultado = await executarRecuperacao()
  console.info('[recuperacao] rodada:', JSON.stringify(resultado))
  return NextResponse.json(resultado)
}
