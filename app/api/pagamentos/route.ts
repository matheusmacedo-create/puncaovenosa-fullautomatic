import { NextResponse } from 'next/server'
import {
  COMPOSICAO_PRECO, MAX_PARCELAS, MINUTOS_PARA_EXPIRAR, PIX_RECEBEDOR, PRECO_CENTAVOS,
} from '@/lib/enrollment'
import { gerarPixCopiaCola } from '@/lib/pix'
import { simulacaoAtiva } from '@/lib/simulacao'
import { corpo, erro, rota } from '@/lib/http'
import { lerInscricaoId } from '@/lib/session'
import { supabaseServer } from '@/lib/supabase/server'

type Payload = {
  metodo?: 'pix' | 'cartao'
  parcelas?: number
  /** Token devolvido pela tokenização do provedor. Nunca o número do cartão. */
  token?: string
  bandeira?: string
  ultimos4?: string
  [extra: string]: unknown
}

/** Campos que jamais devem chegar ao servidor — dado de cartão é PCI. */
const PROIBIDOS = ['numero', 'number', 'pan', 'cvv', 'cvc', 'validade', 'expiry']

/**
 * Abre uma cobrança para a inscrição da sessão.
 *
 * [INTEGRAÇÃO] Nenhum provedor é chamado ainda. No PIX devolvemos o código
 * estático; no cartão apenas registramos a intenção. Quando a Único entrar,
 * é aqui que a cobrança é criada de verdade e `provedor_id` é preenchido.
 */
export function POST(request: Request) {
  return rota(async () => {
    const inscricaoId = await lerInscricaoId()
    if (!inscricaoId) return erro('Preencha seus dados antes de pagar.', 401)

    const body = await corpo<Payload>(request)
    if (!body) return erro('Corpo da requisição inválido.', 400)

    const encontrado = PROIBIDOS.filter(c => body[c] !== undefined)
    if (encontrado.length) {
      console.error('[funil] tentativa de enviar dado de cartão para a API:', encontrado.join(', '))
      return erro('Dados do cartão não devem ser enviados ao servidor. Use a tokenização do provedor.', 400)
    }

    const metodo = body.metodo ?? 'pix'
    if (metodo !== 'pix' && metodo !== 'cartao') return erro('Meio de pagamento inválido.', 422)

    const parcelas = metodo === 'cartao' ? Number(body.parcelas ?? 1) : 1
    if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > MAX_PARCELAS) {
      return erro(`Parcelamento deve ser entre 1 e ${MAX_PARCELAS} vezes.`, 422)
    }
    if (metodo === 'cartao' && body.ultimos4 && !/^[0-9]{4}$/.test(body.ultimos4)) {
      return erro('Últimos dígitos do cartão inválidos.', 422)
    }

    // O txid identifica a cobrança para o provedor e entra no próprio
    // payload do PIX, o que permite conciliar o pagamento no webhook.
    const txid = crypto.randomUUID().replace(/-/g, '').slice(0, 25)

    const { data, error } = await supabaseServer()
      .from('pagamentos')
      .insert({
        inscricao_id: inscricaoId,
        valor_centavos: PRECO_CENTAVOS,
        itens: COMPOSICAO_PRECO,
        metodo,
        parcelas,
        status: 'pendente',
        txid: metodo === 'pix' ? txid : null,
        bandeira: metodo === 'cartao' ? (body.bandeira ?? null) : null,
        ultimos4: metodo === 'cartao' ? (body.ultimos4 ?? null) : null,
        pix_copia_cola: metodo === 'pix'
          ? gerarPixCopiaCola({ ...PIX_RECEBEDOR, valorCentavos: PRECO_CENTAVOS, txid })
          : null,
      })
      .select('id, metodo, parcelas, valor_centavos, itens, status, pix_copia_cola, criado_em')
      .single()

    if (error || !data) {
      console.error('[funil] criação de pagamento falhou:', error)
      return erro('Não foi possível gerar a cobrança. Tente novamente.', 502)
    }

    return NextResponse.json({
      id: data.id,
      metodo: data.metodo,
      parcelas: data.parcelas,
      valorCentavos: data.valor_centavos,
      itens: data.itens,
      status: data.status,
      pixCopiaCola: data.pix_copia_cola,
      criadoEm: data.criado_em,
      minutosParaExpirar: MINUTOS_PARA_EXPIRAR,
      simulacao: simulacaoAtiva(),
    })
  })
}
