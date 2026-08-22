import { NextResponse } from 'next/server'
import { pesquisarEnderecos, PesquisaCurtaDemais } from '@/lib/cep'
import { erro, rota } from '@/lib/http'

/** Quantos resultados a tela mostra. A ViaCEP devolve até 50, ordenados por
 *  proximidade do nome — as primeiras são as que interessam, e uma lista
 *  longa numa tela de celular atrapalha mais do que ajuda. */
const MAXIMO = 8

/**
 * Pesquisa de CEP pelo endereço, para quem não sabe o próprio CEP.
 *
 * Pública pelo mesmo motivo de `/api/cep/[cep]`: não devolve nada sobre
 * nenhum aluno, só endereços que os Correios já publicam.
 */
export function GET(request: Request) {
  return rota(async () => {
    const { searchParams } = new URL(request.url)
    const uf = searchParams.get('uf') ?? ''
    const cidade = searchParams.get('cidade') ?? ''
    const logradouro = searchParams.get('logradouro') ?? ''

    try {
      const encontrados = await pesquisarEnderecos(uf, cidade, logradouro)
      return NextResponse.json(
        { enderecos: encontrados.slice(0, MAXIMO), total: encontrados.length },
        { headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=2592000' } },
      )
    } catch (e) {
      if (e instanceof PesquisaCurtaDemais) return erro(e.message, 422)
      console.error('[funil] pesquisa de endereço falhou:', e)
      return erro('Não foi possível pesquisar agora.', 503)
    }
  })
}
