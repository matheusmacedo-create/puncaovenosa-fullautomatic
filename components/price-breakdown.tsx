import { COMPOSICAO_PRECO, formatarBRL, PRECO_CENTAVOS } from '@/lib/enrollment'

/**
 * Composição do preço, item a item.
 *
 * O aluno paga o total à vista; a quebra existe para ele ver exatamente o
 * que está comprando. Sem isso, quem lê "matrícula R$ 99" solto no anúncio
 * chega ao checkout achando que o curso custa 99.
 */
export function PriceBreakdown({ itens = COMPOSICAO_PRECO, total = PRECO_CENTAVOS }: {
  itens?: readonly { id: string; rotulo: string; detalhe?: string; centavos: number }[]
  total?: number
}) {
  return <dl className="price-breakdown">
    {itens.map(item => <div className="price-line" key={item.id}>
      <dt>{item.rotulo}{item.detalhe && <small>{item.detalhe}</small>}</dt>
      <dd>{formatarBRL(item.centavos)}</dd>
    </div>)}
    <div className="price-line total">
      <dt>Total à vista</dt>
      <dd>{formatarBRL(total)}</dd>
    </div>
  </dl>
}
