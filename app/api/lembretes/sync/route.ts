import { NextResponse } from 'next/server'
import { varrerLembretes } from '@/lib/lembretes'

/** A rodada envia com pausa entre um e-mail e outro; o padrão de 60s não basta. */
export const maxDuration = 120

/**
 * Chamada 1x/dia pelo cron da Vercel (vercel.json), no meio da manhã —
 * lembrete que chega de madrugada é lido junto com o resto da caixa e
 * esquecido do mesmo jeito.
 *
 * Protegida por CRON_SECRET, como /api/meta-audiencia/sync. Sem a variável,
 * a rota fica fechada.
 */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET?.trim()
  if (!segredo || request.headers.get('authorization') !== `Bearer ${segredo}`) {
    return new NextResponse('Não autorizado.', { status: 401 })
  }
  return NextResponse.json(await varrerLembretes())
}
