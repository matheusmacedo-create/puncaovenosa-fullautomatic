import { NextResponse } from 'next/server'
import { varrerLembretes } from '@/lib/lembretes'

/** A rodada envia com pausa entre um e-mail e outro; o padrão de 60s não basta. */
export const maxDuration = 120

/**
 * Chamada 8x/dia, das 7h às 21h de Brasília, pelo GitHub Actions
 * (.github/workflows/lembretes.yml) — o plano Hobby da Vercel não aceita cron
 * mais que diário. Fora das 7h–22h a varredura não envia: lembrete de
 * madrugada é lido junto com o resto da caixa e esquecido do mesmo jeito.
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
