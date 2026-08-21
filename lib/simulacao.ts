/**
 * Interruptor da simulação de pagamento.
 *
 * Enquanto a Único não está integrada, o funil precisa tratar a cobrança
 * como aprovada — senão não dá para percorrer as etapas seguintes. Esse
 * atalho é, na prática, um botão de "inscrição grátis": com ele ligado,
 * qualquer visitante conclui a inscrição sem pagar. Por isso é opt-in.
 *
 * A leitura é feita NO SERVIDOR, a cada requisição, e o estado viaja para o
 * navegador dentro da resposta da cobrança. Isso é deliberado: uma variável
 * `NEXT_PUBLIC_*` é embutida no bundle em tempo de build, então mudá-la no
 * painel só teria efeito depois de um novo deploy.
 *
 * Como variável de servidor, ela também deixa de ser embutida no JavaScript
 * que o visitante baixa.
 *
 * NÃO condicione isto a `NODE_ENV !== 'production'`. Na Vercel, todo deploy
 * roda com NODE_ENV=production — inclusive os de preview —, então essa
 * condição desliga a simulação em qualquer ambiente publicado, e a variável
 * passa a não ter efeito nenhum sem dizer por quê. A proteção aqui é a
 * variável ser opt-in, somada ao aviso visível na tela de pagamento e ao
 * que /api/diagnostico reporta.
 */
export function simulacaoAtiva(): boolean {
  // SIMULAR_PAGAMENTO é o nome preferido. O NEXT_PUBLIC_ é aceito para não
  // quebrar quem já configurou com ele, mas exige rebuild para valer.
  const valor = process.env.SIMULAR_PAGAMENTO ?? process.env.NEXT_PUBLIC_SIMULAR_PAGAMENTO
  return valor?.trim().toLowerCase() === 'true'
}
