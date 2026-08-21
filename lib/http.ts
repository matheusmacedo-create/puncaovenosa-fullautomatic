import { NextResponse } from 'next/server'
import { SupabaseNaoConfigurado, SupabaseUrlInvalida } from '@/lib/supabase/server'

/** Resposta de erro no formato que o front espera: { erro: string }. */
export const erro = (mensagem: string, status: number) => NextResponse.json({ erro: mensagem }, { status })

/**
 * Envolve um handler para que nenhuma exceção vaze detalhe de banco para o
 * cliente. Erros inesperados viram 500 genérico e vão para o log do servidor.
 */
export function rota<T>(handler: () => Promise<NextResponse<T> | NextResponse<{ erro: string }>>) {
  return handler().catch((e: unknown) => {
    if (e instanceof SupabaseNaoConfigurado || e instanceof SupabaseUrlInvalida) {
      console.error('[funil] configuração do Supabase:', e.message)
      return erro('Serviço de inscrição indisponível no momento.', 503)
    }
    console.error('[funil] erro inesperado:', e)
    return erro('Não foi possível concluir. Tente novamente.', 500)
  })
}

/** Lê o corpo JSON sem estourar quando vem vazio ou malformado. */
export async function corpo<T>(request: Request): Promise<T | null> {
  try { return (await request.json()) as T } catch { return null }
}
