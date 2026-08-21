/**
 * Interruptor da simulação de pagamento.
 *
 * Enquanto a Único não está integrada, o funil precisa de um jeito de
 * confirmar uma cobrança à mão — senão não dá para testar o fluxo inteiro.
 * Esse atalho, porém, é literalmente um botão de "inscrição grátis": com ele
 * ligado, qualquer visitante confirma o próprio pagamento sem pagar.
 *
 * Por isso ele é OPT-IN e vale para o cliente e para o servidor. Em
 * produção, deixe a variável ausente: aí só o webhook do provedor confirma
 * pagamento.
 */
export const SIMULACAO_ATIVA =
  process.env.NODE_ENV !== 'production' &&
  process.env.SIMULAR_PAGAMENTO === 'true'
