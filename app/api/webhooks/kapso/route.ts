import { after, NextResponse } from 'next/server'
import { assinaturaConfere, CABECALHO_DA_ASSINATURA, kapsoConfigurado, lerMensagensRecebidas } from '@/lib/kapso'
import { pedeParaSair } from '@/lib/recuperacao'
import { bloquearNumero } from '@/lib/recuperacao-servidor'

/**
 * Mensagens que chegam ao número da escola na Kapso.
 *
 * Só uma coisa é feita com elas: quem responde SAIR (ou PARAR, STOP…, a
 * mensagem inteira) sai da recuperação, de vez (`whatsapp_bloqueios`). Nada
 * é respondido daqui — a conversa com a pessoa, quando houver, é da
 * secretaria, pela caixa de entrada da própria Kapso. O texto recebido não é
 * gravado.
 *
 * O webhook é criado pelo botão em /secretaria (aba WhatsApp), com a senha
 * derivada da chave; sem assinatura certa, 401. Responde na hora e trabalha
 * depois (`after`): a Kapso tenta de novo se não receber 200 em 10 s, e
 * gravar o mesmo bloqueio duas vezes não muda nada.
 */
export async function POST(request: Request) {
  if (!kapsoConfigurado()) return new NextResponse('Não encontrado.', { status: 404 })

  const cru = await request.text()
  if (!assinaturaConfere(cru, request.headers.get(CABECALHO_DA_ASSINATURA))) {
    return new NextResponse('Assinatura inválida.', { status: 401 })
  }

  let corpo: unknown = null
  try { corpo = JSON.parse(cru) } catch { return NextResponse.json({ ok: true, ignorado: 'corpo inválido' }) }

  const saidas = lerMensagensRecebidas(corpo, request.headers.get('x-webhook-event')).filter(m => pedeParaSair(m.texto))
  if (saidas.length) {
    after(async () => {
      for (const m of saidas) await bloquearNumero(m.numero, 'resposta')
    })
  }
  return NextResponse.json({ ok: true })
}
