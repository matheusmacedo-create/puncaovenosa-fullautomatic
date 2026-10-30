import { NextResponse } from 'next/server'
import { verificar } from '@/lib/link-assinado'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * Para os lembretes de recuperação de uma inscrição.
 *
 * Só POST, de propósito: antivírus de e-mail e pré-visualização de link
 * abrem todo GET que passa pela caixa, e um descadastro por GET desligaria
 * os lembretes de quem nunca pediu. Duas origens chegam aqui:
 *
 * - o botão do cliente de e-mail (`List-Unsubscribe-Post`, RFC 8058), com
 *   os parâmetros assinados na URL e corpo `List-Unsubscribe=One-Click`;
 * - o formulário de `/lembretes/parar`, que funciona sem JavaScript e manda
 *   os mesmos parâmetros no corpo.
 *
 * Comprovantes continuam saindo: são resposta a algo que a pessoa fez.
 */
export async function POST(request: Request) {
  const url = new URL(request.url)
  const p: Record<string, string> = Object.fromEntries(url.searchParams)
  const tipo = request.headers.get('content-type') ?? ''
  if (tipo.includes('application/x-www-form-urlencoded') || tipo.includes('multipart/form-data')) {
    const form = await request.formData().catch(() => null)
    for (const chave of ['i', 'f', 'x', 's']) {
      const v = form?.get(chave)
      if (typeof v === 'string' && !p[chave]) p[chave] = v
    }
  }

  const resultado = verificar(p)
  const veioDoFormulario = !url.searchParams.has('s')
  if (!resultado.ok || resultado.finalidade !== 'parar_lembretes') {
    return veioDoFormulario
      ? NextResponse.redirect(new URL('/lembretes/parar?erro=1', url), 303)
      : new NextResponse('Link inválido.', { status: 400 })
  }

  const { error } = await supabaseServer()
    .from('inscricoes')
    .update({ lembretes_desligados_em: new Date().toISOString() })
    .eq('id', resultado.inscricaoId)
    .is('lembretes_desligados_em', null)
  if (error) {
    console.error('[lembretes] falha ao desligar:', error)
    return veioDoFormulario
      ? NextResponse.redirect(new URL('/lembretes/parar?erro=1', url), 303)
      : new NextResponse('Não foi possível agora.', { status: 502 })
  }

  return veioDoFormulario
    ? NextResponse.redirect(new URL('/lembretes/parar?feito=1', url), 303)
    : new NextResponse(null, { status: 200 })
}
