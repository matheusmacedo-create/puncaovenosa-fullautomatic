import { NextResponse } from 'next/server'
import { abrirSessaoDaSecretaria, fecharSessaoDaSecretaria, secretariaHabilitada, senhaConfere } from '@/lib/secretaria'

/**
 * Entrada e saída do painel da secretaria.
 *
 * Recebe o formulário da própria página e redireciona de volta, para o painel
 * funcionar sem JavaScript — a secretaria pode estar num computador antigo, e
 * uma tela de acompanhamento não deveria depender de bundle.
 */
export async function POST(request: Request) {
  if (!secretariaHabilitada()) return new NextResponse('Não encontrado.', { status: 404 })

  const form = await request.formData()
  const destino = new URL('/secretaria', request.url)

  if (form.get('sair') !== null) {
    await fecharSessaoDaSecretaria()
    return NextResponse.redirect(destino, { status: 303 })
  }

  const senha = String(form.get('senha') ?? '')
  if (!senhaConfere(senha)) {
    destino.searchParams.set('erro', '1')
    return NextResponse.redirect(destino, { status: 303 })
  }

  await abrirSessaoDaSecretaria()
  return NextResponse.redirect(destino, { status: 303 })
}
