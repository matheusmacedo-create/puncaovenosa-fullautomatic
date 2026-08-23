import { NextResponse } from 'next/server'
import { retentarRemocoesPendentes, sincronizarAbandonados } from '@/lib/meta-audiencia'

/**
 * Chamada 1x/dia pelo cron da Vercel (vercel.json) — o plano Hobby não
 * libera intervalo menor que diário. A remoção de quem já pagou é em tempo
 * real desde a confirmação de pagamento; esta rota só cuida de quem ainda
 * não converteu e de remoções que falharam naquele momento.
 *
 * Protegida por CRON_SECRET: a Vercel manda esse valor no cabeçalho
 * Authorization quando chama pela grade do cron. Sem a variável definida, a
 * rota fica fechada — nunca cai para "aberta por padrão".
 */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET?.trim()
  if (!segredo || request.headers.get('authorization') !== `Bearer ${segredo}`) {
    return new NextResponse('Não autorizado.', { status: 401 })
  }

  const [{ adicionados, falhas }, { removidos }] = await Promise.all([
    sincronizarAbandonados(),
    retentarRemocoesPendentes(),
  ])

  return NextResponse.json({ adicionados, falhas, removidos })
}
