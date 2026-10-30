import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { varrerLembretes } from '@/lib/lembretes'
import { supabaseServer } from '@/lib/supabase/server'

/** A rodada envia com pausa entre um e-mail e outro; o padrão de 60s não basta. */
export const maxDuration = 120

/**
 * Chamada 8x/dia, das 7h às 21h de Brasília, pelo pg_cron do próprio
 * Supabase (migration 0018) — o plano Hobby da Vercel não aceita cron mais
 * que diário. Fora das 7h–22h a varredura não envia: lembrete de madrugada é
 * lido junto com o resto da caixa e esquecido do mesmo jeito.
 *
 * O segredo nasce e mora no Vault do banco (`lembretes_segredo`): o pg_cron
 * o manda no cabeçalho, e esta rota confere contra o mesmo Vault, por uma
 * função que só a chave de serviço executa. Ninguém precisa copiar o valor
 * para a Vercel — nem vê-lo. Sem o segredo no Vault, a rota fica fechada.
 */
export async function GET(request: Request) {
  const recebido = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? ''
  const { data: esperado, error } = await supabaseServer().rpc('segredo_dos_lembretes')
  if (error) console.error('[lembretes] não foi possível ler o segredo:', error.message)

  const a = Buffer.from(recebido)
  const b = Buffer.from(typeof esperado === 'string' ? esperado : '')
  if (b.length < 32 || a.length !== b.length || !timingSafeEqual(a, b)) {
    return new NextResponse('Não autorizado.', { status: 401 })
  }
  return NextResponse.json(await varrerLembretes())
}
