import { NextResponse } from 'next/server'
import { numeroDoWhatsapp } from '@/lib/recuperacao'
import { bloquearNumero } from '@/lib/recuperacao-servidor'
import { secretariaAutenticada, secretariaHabilitada } from '@/lib/secretaria'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * Tira uma pessoa da recuperação pelo painel — quem pediu por outro canal
 * (ligação, e-mail, pessoalmente) para não receber mensagem. Recebe o id da
 * inscrição, nunca o telefone do formulário: o número sai do banco.
 */
export async function POST(request: Request) {
  if (!secretariaHabilitada() || !(await secretariaAutenticada())) {
    return new NextResponse('Não encontrado.', { status: 404 })
  }

  const form = await request.formData()
  const inscricaoId = String(form.get('inscricaoId') ?? '')
  const destino = new URL('/secretaria', request.url)

  const { data } = inscricaoId
    ? await supabaseServer().from('inscricoes').select('telefone').eq('id', inscricaoId).maybeSingle()
    : { data: null }
  const numero = numeroDoWhatsapp(data?.telefone)

  if (!numero || !(await bloquearNumero(numero, 'secretaria'))) {
    destino.searchParams.set('erroWhatsapp', 'Não foi possível tirar da recuperação. A migration 0017 já foi aplicada?')
  } else {
    destino.searchParams.set('bloqueado', '1')
  }
  return NextResponse.redirect(destino, { status: 303 })
}
