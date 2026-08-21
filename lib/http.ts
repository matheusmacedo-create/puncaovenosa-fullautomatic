import { NextResponse } from 'next/server'
import { SupabaseNaoConfigurado, SupabaseUrlInvalida } from '@/lib/supabase/server'
import { UnicopagNaoConfigurado } from '@/lib/unicopag'

/** Resposta de erro no formato que o front espera: { erro: string }. */
export const erro = (mensagem: string, status: number) => NextResponse.json({ erro: mensagem }, { status })

/**
 * Envolve um handler para que nenhuma exceção vaze detalhe de banco para o
 * cliente. Erros inesperados viram 500 genérico e vão para o log do servidor.
 */
export function rota(handler: () => Promise<NextResponse<unknown>>) {
  return handler().catch((e: unknown) => {
    if (e instanceof SupabaseNaoConfigurado || e instanceof SupabaseUrlInvalida) {
      console.error('[funil] configuração do Supabase:', e.message)
      return erro('Serviço de inscrição indisponível no momento.', 503)
    }
    // Acontece quando a simulação foi desligada à mão sem haver provedor: o
    // código tenta cobrar de verdade e não encontra a chave. É configuração,
    // não falha do aluno — e virava um 500 mudo, que não dizia nada a
    // ninguém.
    if (e instanceof UnicopagNaoConfigurado) {
      console.error('[funil] pagamento indisponível:', e.message,
        '— defina UNICO_API_KEY ou remova SIMULAR_PAGAMENTO=false.')
      return erro('Pagamento indisponível no momento. Tente novamente em instantes.', 503)
    }
    console.error('[funil] erro inesperado:', e)
    return erro('Não foi possível concluir. Tente novamente.', 500)
  })
}

/** Lê o corpo JSON sem estourar quando vem vazio ou malformado. */
export async function corpo<T>(request: Request): Promise<T | null> {
  try { return (await request.json()) as T } catch { return null }
}
