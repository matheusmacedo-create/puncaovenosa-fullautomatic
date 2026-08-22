import { NextResponse } from 'next/server'
import { buscarEndereco, CepNaoEncontrado, CEP_VALIDO } from '@/lib/cep'
import { digits } from '@/lib/enrollment'
import { erro, rota } from '@/lib/http'

/**
 * Consulta de CEP para a triagem.
 *
 * Pública de propósito: não devolve nada sobre nenhum aluno, só o endereço de
 * um CEP — a mesma informação que os Correios publicam. Exigir sessão aqui
 * complicaria sem proteger nada.
 */
export function GET(_request: Request, { params }: { params: Promise<{ cep: string }> }) {
  return rota(async () => {
    const { cep } = await params
    const limpo = digits(cep)

    if (!CEP_VALIDO.test(limpo)) return erro('CEP precisa ter 8 números.', 422)

    try {
      const endereco = await buscarEndereco(limpo)
      return NextResponse.json(endereco, {
        // O mesmo CEP vai ser pedido de novo pelo próximo aluno do bairro.
        headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=2592000' },
      })
    } catch (e) {
      if (e instanceof CepNaoEncontrado) return erro('CEP não encontrado. Confira os números.', 404)
      // Provedor fora do ar não pode travar a triagem: quem chamou segue sem
      // o endereço, e o aluno continua com o CEP que digitou.
      console.error('[funil] consulta de CEP falhou:', e)
      return erro('Não foi possível consultar o CEP agora.', 503)
    }
  })
}
