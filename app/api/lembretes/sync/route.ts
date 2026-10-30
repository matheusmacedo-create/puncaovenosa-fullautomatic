import { NextResponse } from 'next/server'
import { varrerLembretes } from '@/lib/lembretes'

/** A rodada envia com pausa entre um e-mail e outro; o padrão de 60s não basta. */
export const maxDuration = 120

/**
 * Chamada 8x/dia, das 7h às 21h de Brasília, pelo pg_cron do próprio
 * Supabase (migration 0018) — o plano Hobby da Vercel não aceita cron mais
 * que diário. Fora das 7h–22h a varredura não envia: lembrete de madrugada é
 * lido junto com o resto da caixa e esquecido do mesmo jeito.
 *
 * Protegida por LEMBRETES_SEGREDO, que o pg_cron lê do Vault do Supabase.
 * Segredo próprio, e não o CRON_SECRET do público de remarketing, para quem
 * agenda os lembretes não poder disparar outra rotina. Sem a variável, a
 * rota fica fechada.
 */
export async function GET(request: Request) {
  const segredo = process.env.LEMBRETES_SEGREDO?.trim()
  if (!segredo || segredo.length < 32 || request.headers.get('authorization') !== `Bearer ${segredo}`) {
    return new NextResponse('Não autorizado.', { status: 401 })
  }
  return NextResponse.json(await varrerLembretes())
}
