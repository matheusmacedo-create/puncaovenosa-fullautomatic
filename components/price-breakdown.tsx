import {
  COBRANCAS, EtapaDeCobranca, formatarBRL, PRECO_CENTAVOS, PRECO_CURSO_CENTAVOS, PRECO_DE_TESTE,
} from '@/lib/enrollment'

/**
 * O que o aluno paga agora e o que fica para depois.
 *
 * O preço sai em duas cobranças — matrícula e curso —, então mostrar só a
 * soma esconderia a metade que importa na hora de decidir: quanto sai do
 * bolso hoje. E mostrar só a parcela de hoje seria a armadilha oposta, a de
 * quem lê "matrícula R$ 99" no anúncio e descobre o resto depois de pagar.
 * As três linhas (hoje, depois, total) existem para que nenhuma das duas
 * leituras erradas seja possível.
 */
export function PriceBreakdown({ itens, total, etapa = 'matricula' }: {
  itens?: readonly { id: string; rotulo: string; detalhe?: string; centavos: number }[]
  total?: number
  etapa?: EtapaDeCobranca
}) {
  const linhas = itens ?? COBRANCAS[etapa].itens
  const agora = total ?? COBRANCAS[etapa].centavos
  // Só a matrícula deixa saldo em aberto; quem está pagando o curso já
  // quitou a outra parte.
  const depois = etapa === 'matricula' ? PRECO_CURSO_CENTAVOS : 0

  return <dl className="price-breakdown">
    {linhas.map(item => <div className="price-line" key={item.id}>
      <dt>{item.rotulo}{item.detalhe && <small>{item.detalhe}</small>}</dt>
      <dd>{formatarBRL(item.centavos)}</dd>
    </div>)}
    <div className="price-line total">
      <dt>Você paga agora</dt>
      <dd>{formatarBRL(agora)}</dd>
    </div>
    {depois > 0 && <div className="price-line depois">
      <dt>Curso presencial<small>Você paga até o dia da aula</small></dt>
      <dd>{formatarBRL(depois)}</dd>
    </div>}
    {depois > 0 && <p className="price-total-curso">Investimento total do curso: {formatarBRL(PRECO_CENTAVOS)}</p>}
    {PRECO_DE_TESTE && <p className="preco-de-teste" role="status">Valor reduzido para teste operacional. Não é o preço do curso.</p>}
  </dl>
}
