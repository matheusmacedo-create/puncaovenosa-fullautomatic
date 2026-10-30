import { NextResponse } from 'next/server'
import { ROTA_INSCRICAO } from '@/lib/enrollment'
import { verificar, type Finalidade } from '@/lib/link-assinado'
import { gravarInscricaoId } from '@/lib/session'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * Porta de entrada dos links dos e-mails: confere a assinatura, abre a
 * sessão da inscrição neste navegador e leva a pessoa ao ponto do funil que
 * o e-mail prometeu. Ver `lib/link-assinado.ts`.
 *
 * Link inválido ou vencido não é erro para o aluno: cai no começo do funil,
 * onde o CPF reencontra o cadastro ("já temos seu cadastro").
 */
const DESTINO: Partial<Record<Finalidade, string>> = {
  pagamento: `${ROTA_INSCRICAO}?etapa=pagamento`,
  curso: `${ROTA_INSCRICAO}?etapa=curso`,
  triagem: '/triagem/1',
  ficha: '/minha-inscricao',
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const p = Object.fromEntries(url.searchParams)
  const resultado = verificar(p)
  const destino = resultado.ok ? DESTINO[resultado.finalidade] : undefined

  if (!resultado.ok || !destino) {
    if (!resultado.ok && resultado.motivo !== 'expirado') console.warn('[retomar] link recusado:', resultado.motivo)
    return NextResponse.redirect(new URL(ROTA_INSCRICAO, url), 303)
  }

  // A inscrição pode ter sido apagada depois do envio: sessão para uma linha
  // que não existe só daria um funil quebrado.
  const { data } = await supabaseServer()
    .from('inscricoes')
    .select('id')
    .eq('id', resultado.inscricaoId)
    .maybeSingle()
  if (!data) return NextResponse.redirect(new URL(ROTA_INSCRICAO, url), 303)

  await gravarInscricaoId(resultado.inscricaoId)
  return NextResponse.redirect(new URL(destino, url), 303)
}
